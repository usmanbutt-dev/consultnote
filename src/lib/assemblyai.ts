import "server-only";
import type { ValidatedAudio } from "./audio";
import { z } from "zod";
import { transcriptSchema, type Transcript } from "./consultation";
import { ApiError } from "./http";
import type { AudioLanguage } from "./languages";
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

async function request(
  path: string,
  signal: AbortSignal,
  init: RequestInit = {},
) {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!key)
    throw new ApiError(
      "AI_AUTH_FAILED",
      "Configure ASSEMBLYAI_API_KEY and restart the app.",
      502,
    );
  return providerJson(
    "AssemblyAI",
    `https://api.assemblyai.com/v2/${path}`,
    { ...init, headers: { authorization: key, ...init.headers } },
    signal,
  );
}

export async function transcribeWithAssemblyAI(
  audio: ValidatedAudio,
  signal: AbortSignal,
  language: AudioLanguage = "auto",
): Promise<{ transcript: Transcript; model: string }> {
  const upload = z.object({ upload_url: z.url() }).safeParse(
    await request("upload", signal, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from(audio.bytes),
    }),
  );
  if (!upload.success) throw invalidProviderOutput("AssemblyAI");
  const id = await submitAssemblyJob(upload.data.upload_url, signal, language);
  while (true) {
    const result = await pollAssemblyJob(id, audio.durationSeconds, signal);
    if (result) return result;
    await waitForPoll(signal);
  }
}

export async function submitAssemblyJob(
  url: string,
  signal: AbortSignal,
  language: AudioLanguage = "auto",
): Promise<string> {
  const submitted = z.object({ id: z.string().min(1) }).safeParse(
    await request("transcript", signal, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audio_url: url,
        speech_models:
          language === "ur" || language === "en-ur"
            ? ["universal-2"]
            : ["universal-3-pro", "universal-2"],
        speaker_labels: true,
        ...(language === "auto" || language === "en-ur"
          ? { language_detection: true }
          : { language_code: language }),
        ...(language === "en-ur"
          ? { language_detection_options: { code_switching: true } }
          : {}),
      }),
    }),
  );
  if (!submitted.success) throw invalidProviderOutput("AssemblyAI");
  return submitted.data.id;
}

export async function pollAssemblyJob(
  id: string,
  durationSeconds: number,
  signal: AbortSignal,
): Promise<{ transcript: Transcript; model: string } | null> {
  const result = resultSchema.safeParse(
    await request(`transcript/${encodeURIComponent(id)}`, signal),
  );
  if (!result.success) throw invalidProviderOutput("AssemblyAI");
  const data = result.data;
  if (data.status === "error")
    throw new ApiError(
      "AI_PROCESSING_FAILED",
      "AssemblyAI could not process this recording. Try another file.",
      503,
    );
  if (data.status !== "completed") {
    if (!["queued", "processing"].includes(data.status))
      throw invalidProviderOutput("AssemblyAI");
    return null;
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
    durationSeconds,
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
