import "server-only";
import type { ValidatedAudio } from "./audio";
import { z } from "zod";
import { transcriptSchema, type Transcript } from "./consultation";
import { ApiError } from "./http";
import {
  invalidProviderOutput,
  providerJson,
  waitForPoll,
} from "./provider-http";

const utteranceSchema = z.object({
  speaker: z.string().nullable(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string().trim().min(1),
});
const resultSchema = z.object({
  status: z.string(),
  text: z.string().nullable().optional(),
  speech_model_used: z.string().nullable().optional(),
  utterances: z.array(utteranceSchema).nullable().optional(),
});

export async function transcribeWithAssemblyAI(
  audio: ValidatedAudio,
  signal: AbortSignal,
): Promise<{ transcript: Transcript; model: string }> {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!key)
    throw new ApiError(
      "AI_AUTH_FAILED",
      "Configure ASSEMBLYAI_API_KEY and restart the app.",
      502,
    );
  const headers = { authorization: key };
  const request = (path: string, init: RequestInit = {}) =>
    providerJson(
      "AssemblyAI",
      `https://api.assemblyai.com/v2/${path}`,
      { ...init, headers: { ...headers, ...init.headers } },
      signal,
    );
  const upload = z
    .object({ upload_url: z.url() })
    .safeParse(
      await request("upload", {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: Buffer.from(audio.bytes),
      }),
    );
  if (!upload.success) throw invalidProviderOutput("AssemblyAI");
  const submitted = z
    .object({ id: z.string().min(1) })
    .safeParse(
      await request("transcript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          audio_url: upload.data.upload_url,
          speech_models: ["universal-3-pro", "universal-2"],
          speaker_labels: true,
          language_detection: true,
        }),
      }),
    );
  if (!submitted.success) throw invalidProviderOutput("AssemblyAI");
  const path = `transcript/${encodeURIComponent(submitted.data.id)}`;
  while (true) {
    const result = resultSchema.safeParse(await request(path));
    if (!result.success) throw invalidProviderOutput("AssemblyAI");
    const data = result.data;
    if (data.status === "error")
      throw new ApiError(
        "AI_UNAVAILABLE",
        "AssemblyAI could not process this recording. Try another file.",
        503,
      );
    if (data.status !== "completed") {
      if (!["queued", "processing"].includes(data.status))
        throw invalidProviderOutput("AssemblyAI");
      await waitForPoll(signal);
      continue;
    }
    if (!data.text?.trim() && !data.utterances?.length)
      throw new ApiError(
        "NO_SPEECH",
        "No speech was detected. Check the recording and try another file.",
        422,
      );
    if (!data.utterances?.length) throw invalidProviderOutput("AssemblyAI");
    const labels = [
      ...new Set(data.utterances.map((u) => u.speaker ?? "unknown")),
    ];
    const transcript = transcriptSchema.safeParse({
      durationSeconds: audio.durationSeconds,
      speakers: labels.map((label, index) => ({
        id: `speaker-${index + 1}`,
        suggestedRole: "unknown",
        reason:
          label === "unknown"
            ? "The voice could not be identified; review this speaker manually."
            : "Voice distinguished by AssemblyAI; review the suggested role.",
      })),
      segments: data.utterances.map((u, index) => ({
        id: `segment-${index + 1}`,
        speakerId: `speaker-${labels.indexOf(u.speaker ?? "unknown") + 1}`,
        startSeconds: u.start / 1000,
        endSeconds: u.end / 1000,
        text: u.text,
      })),
    });
    if (!transcript.success) throw invalidProviderOutput("AssemblyAI");
    return {
      transcript: transcript.data,
      model: `AssemblyAI:${data.speech_model_used ?? "universal-3-pro/universal-2"}`,
    };
  }
}
