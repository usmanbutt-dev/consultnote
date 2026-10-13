import "server-only";
import type { ValidatedAudio } from "./audio";
import { transcribeWithAssemblyAI } from "./assemblyai";
import { groqModel, suggestRoles } from "./groq";
import {
  transcribeAudio as transcribeWithGemini,
  type TranscriptionResult,
} from "./gemini";
import { ApiError } from "./http";
import { withProviderDeadline } from "./provider-http";

export function processingConfiguration() {
  const provider = process.env.TRANSCRIPTION_PROVIDER?.trim() || "assemblyai";
  return {
    provider,
    transcriptionConfigured: Boolean(
      provider === "assemblyai"
        ? process.env.ASSEMBLYAI_API_KEY?.trim()
        : process.env.GEMINI_API_KEY?.trim(),
    ),
    notesConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    notesModel: groqModel(),
  };
}

export async function transcribeAudio(
  audio: ValidatedAudio,
): Promise<TranscriptionResult> {
  const { provider } = processingConfiguration();
  if (provider === "gemini") return transcribeWithGemini(audio);
  if (provider !== "assemblyai")
    throw new ApiError(
      "AI_AUTH_FAILED",
      "Set TRANSCRIPTION_PROVIDER to assemblyai or gemini, then restart the app.",
      502,
    );
  return withProviderDeadline("Transcription", async (signal) => {
    const result = await transcribeWithAssemblyAI(audio, signal);
    try {
      const transcript = await withProviderDeadline(
        "Role suggestions",
        (roleSignal) =>
          suggestRoles(
            result.transcript,
            AbortSignal.any([signal, roleSignal]),
          ),
        15000,
      );
      return {
        transcript,
        model: `${result.model}; Groq:${groqModel()}`,
        promptVersion: "assemblyai-v1/roles-v1",
      };
    } catch {
      return {
        transcript: {
          ...result.transcript,
          speakers: result.transcript.speakers.map((s) => ({
            ...s,
            reason:
              "Role suggestions unavailable. Select this speaker's role manually.",
          })),
        },
        model: result.model,
        promptVersion: "assemblyai-v1",
      };
    }
  });
}
