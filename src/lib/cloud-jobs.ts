import "server-only";
import { z } from "zod";
import { adminSupabase } from "./supabase/server";
import {
  validateAudioPath,
  storedAudio,
  removeStoredAudio,
} from "./cloud-audio";
import { submitAssemblyJob, pollAssemblyJob } from "./assemblyai";
import { addRoleSuggestions } from "./ai";
import { audioLanguageSchema } from "./languages";
import { ApiError } from "./http";
import { withProviderDeadline } from "./provider-http";
import { transcriptSchema } from "./consultation";

export const jobInputSchema = z.strictObject({
  id: z.uuid(),
  path: z.string(),
  language: audioLanguageSchema,
});
const transcriptionResultSchema = z.object({
  transcript: transcriptSchema,
  model: z.string(),
  promptVersion: z.string(),
});
const jobSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  audio_path: z.string(),
  language: audioLanguageSchema,
  duration_seconds: z.number().nullable(),
  provider_id: z.string().nullable(),
  status: z.enum([
    "starting",
    "processing",
    "finalizing",
    "completed",
    "failed",
    "cancelled",
  ]),
  result: transcriptionResultSchema.nullable(),
  failure: z
    .object({ code: z.string(), message: z.string(), status: z.number() })
    .nullable(),
  lease_until: z.string().nullable(),
  created_at: z.string(),
});
type Job = z.infer<typeof jobSchema>;
function storageFailure() {
  return new ApiError(
    "STORAGE_FAILED",
    "Cloud processing could not be read. Please retry.",
    503,
  );
}
async function readJob(userId: string, id: string): Promise<Job | null> {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(
      "INVALID_INPUT",
      "Choose a valid transcription job.",
      400,
    );
  const { data, error } = await adminSupabase()
    .from("transcription_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw storageFailure();
  return data ? jobSchema.parse(data) : null;
}
function publicJob(job: Job) {
  return {
    id: job.id,
    status: job.status,
    ...(job.result ? { result: job.result } : {}),
    ...(job.failure ? { failure: job.failure } : {}),
  };
}
async function failJob(job: Job, error: unknown) {
  const failure = error instanceof ApiError ? error : storageFailure();
  await adminSupabase()
    .from("transcription_jobs")
    .update({
      status: "failed",
      failure: {
        code: failure.code,
        message: failure.message,
        status: failure.status,
      },
    })
    .eq("user_id", job.user_id)
    .eq("id", job.id)
    .in("status", ["starting", "processing", "finalizing"]);
  await removeStoredAudio(job.audio_path, job.user_id).catch(() => {});
}
export async function startJob(
  userId: string,
  input: z.infer<typeof jobInputSchema>,
) {
  validateAudioPath(input.path, userId);
  const previous = await readJob(userId, input.id);
  if (previous) {
    if (
      previous.audio_path !== input.path ||
      previous.language !== input.language
    )
      throw new ApiError(
        "INVALID_INPUT",
        "This job belongs to a different recording.",
        400,
      );
    return publicJob(previous);
  }
  if (
    (process.env.TRANSCRIPTION_PROVIDER?.trim() || "assemblyai") !==
    "assemblyai"
  )
    throw new ApiError(
      "CONFIGURATION_REQUIRED",
      "Cloud transcription requires AssemblyAI. Update the server configuration.",
      503,
    );
  const client = adminSupabase();
  const reservation = await client.rpc("start_transcription", {
    job_id: input.id,
    owner_id: userId,
    object_path: input.path,
    audio_language: input.language,
  });
  if (reservation.error) throw storageFailure();
  if (!reservation.data)
    throw new ApiError(
      "PROCESSING_LIMIT",
      "Another recording is processing or the demo limit was reached. Resume it or try later.",
      429,
    );
  const job: Job = {
    id: input.id,
    user_id: userId,
    audio_path: input.path,
    language: input.language,
    duration_seconds: null,
    provider_id: null,
    status: "starting",
    result: null,
    failure: null,
    lease_until: null,
    created_at: new Date().toISOString(),
  };
  try {
    const { audio, url } = await storedAudio(input.path, userId);
    const providerId = await withProviderDeadline(
      "AssemblyAI",
      (signal) => submitAssemblyJob(url, signal, input.language),
      20000,
    );
    const { data, error } = await client
      .from("transcription_jobs")
      .update({
        provider_id: providerId,
        duration_seconds: audio.durationSeconds,
        status: "processing",
      })
      .eq("user_id", userId)
      .eq("id", input.id)
      .eq("status", "starting")
      .select("id")
      .maybeSingle();
    if (error) throw storageFailure();
    if (!data)
      throw new ApiError(
        "AI_UNAVAILABLE",
        "Transcription was cancelled. Choose another recording.",
        409,
      );
    return { id: input.id, status: "processing" };
  } catch (error) {
    await failJob(job, error);
    throw error;
  }
}
export async function pollJob(userId: string, id: string) {
  const job = await readJob(userId, id);
  if (!job)
    throw new ApiError(
      "NOT_FOUND",
      "This transcription job was not found.",
      404,
    );
  if (["completed", "failed", "cancelled"].includes(job.status))
    return publicJob(job);
  if (
    Date.now() - Date.parse(job.created_at) > 15 * 60 * 1000 ||
    (job.status === "starting" &&
      Date.now() - Date.parse(job.created_at) > 90 * 1000)
  ) {
    const error = new ApiError(
      "AI_TIMEOUT",
      "Transcription expired. Upload the recording again to start a new job.",
      504,
    );
    await failJob(job, error);
    throw error;
  }
  if (
    job.status === "starting" ||
    (job.status === "finalizing" &&
      Date.parse(job.lease_until ?? "") > Date.now())
  )
    return publicJob(job);
  if (!job.provider_id || !job.duration_seconds) throw storageFailure();
  // A transient fetch failure leaves the existing provider job resumable.
  let result;
  try {
    result = await withProviderDeadline(
      "AssemblyAI",
      (signal) =>
        pollAssemblyJob(job.provider_id!, job.duration_seconds!, signal),
      15000,
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["AI_PROCESSING_FAILED", "NO_SPEECH", "INVALID_AI_OUTPUT"].includes(
        error.code,
      )
    ) {
      await failJob(job, error);
      return publicJob({
        ...job,
        status: "failed",
        failure: {
          code: error.code,
          message: error.message,
          status: error.status,
        },
      });
    }
    throw error;
  }
  if (!result) return publicJob(job);
  const client = adminSupabase();
  const claim = await client
    .from("transcription_jobs")
    .update({
      status: "finalizing",
      lease_until: new Date(Date.now() + 60000).toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id)
    .or(
      `status.eq.processing,and(status.eq.finalizing,lease_until.lt.${new Date().toISOString()})`,
    )
    .select("id")
    .maybeSingle();
  if (claim.error) throw storageFailure();
  if (!claim.data) return { id, status: "finalizing" };
  try {
    const finalized = await addRoleSuggestions(
      result,
      AbortSignal.timeout(20000),
    );
    const saved = await client
      .from("transcription_jobs")
      .update({ status: "completed", result: finalized, lease_until: null })
      .eq("user_id", userId)
      .eq("id", id)
      .eq("status", "finalizing")
      .select("id")
      .maybeSingle();
    if (saved.error) throw storageFailure();
    if (!saved.data)
      throw new ApiError(
        "AI_UNAVAILABLE",
        "Transcription was cancelled. Choose another recording.",
        409,
      );
    await removeStoredAudio(job.audio_path, userId).catch(() => {});
    return { id, status: "completed", result: finalized };
  } catch (error) {
    await failJob(job, error);
    throw error;
  }
}
export async function cancelJob(userId: string, id: string) {
  const job = await readJob(userId, id);
  if (!job)
    throw new ApiError(
      "NOT_FOUND",
      "This transcription job was not found.",
      404,
    );
  const { error } = await adminSupabase()
    .from("transcription_jobs")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("id", id)
    .in("status", ["starting", "processing", "finalizing"]);
  if (error) throw storageFailure();
  await removeStoredAudio(job.audio_path, userId).catch(() => {});
}
