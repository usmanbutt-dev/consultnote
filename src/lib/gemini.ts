import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ValidatedAudio } from "./audio";
import {
  speakerSchema,
  segmentSchema,
  transcriptSchema,
  type Transcript,
} from "./consultation";
import { ApiError } from "./http";
import {
  TRANSCRIPTION_PROMPT_VERSION,
  transcriptionInstructions,
} from "./prompts";

export type TranscriptionResult = {
  transcript: Transcript;
  model: string;
  promptVersion: string;
};

const payloadSchema = z.strictObject({
  hasSpeech: z.boolean(),
  speakers: z.array(speakerSchema),
  segments: z.array(segmentSchema),
});
const responseSchema = z.toJSONSchema(payloadSchema);
const DEADLINE_MS = 120_000;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function invalidOutput(): ApiError {
  return new ApiError(
    "INVALID_AI_OUTPUT",
    "Gemini returned an incomplete or invalid transcript. Retry, or use a shorter recording.",
    502,
  );
}

function providerFailure(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const info =
    error && typeof error === "object"
      ? (error as {
          status?: number;
          statusCode?: number;
          name?: string;
          message?: string;
        })
      : {};
  const status = info.status ?? info.statusCode;
  if (
    status === 408 ||
    status === 504 ||
    /^(RequestTimeoutError|TimeoutError|AbortError)$/.test(info.name ?? "")
  ) {
    return new ApiError(
      "AI_TIMEOUT",
      "Gemini took too long. Retry, or use a shorter recording.",
      504,
    );
  }
  if (
    status === 401 ||
    status === 403 ||
    (status === 400 &&
      /API_KEY_INVALID|API key not valid/i.test(info.message ?? ""))
  ) {
    return new ApiError(
      "AI_AUTH_FAILED",
      "Gemini could not authenticate. Check GEMINI_API_KEY and model access, then restart the app.",
      502,
    );
  }
  if (status === 429) {
    return new ApiError(
      "AI_QUOTA_EXCEEDED",
      "Gemini quota reached. Wait a moment, then retry.",
      429,
    );
  }
  if (status === 503) {
    return new ApiError(
      "AI_UNAVAILABLE",
      "Gemini is temporarily busy or unavailable (503). Wait a moment, then retry.",
      503,
    );
  }
  return new ApiError(
    "AI_UNAVAILABLE",
    "Gemini is unavailable. Check your connection and configured model access, then retry.",
    503,
  );
}

export async function transcribeAudio(
  audio: ValidatedAudio,
): Promise<TranscriptionResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError(
      "AI_AUTH_FAILED",
      "Configure GEMINI_API_KEY in .env.local, then restart the app.",
      502,
    );
  }
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ApiError(
          "AI_TIMEOUT",
          "Gemini took too long. Retry, or use a shorter recording.",
          504,
        ),
      );
    }, DEADLINE_MS);
  });
  try {
    const client = new GoogleGenAI({ apiKey, vertexai: false });
    const response = await Promise.race([
      client.interactions.create(
        {
          api_version: "v1beta",
          model,
          stream: false,
          store: false,
          system_instruction: transcriptionInstructions(audio.durationSeconds),
          input: [
            {
              type: "audio",
              data: Buffer.from(audio.bytes).toString("base64"),
              mime_type: audio.mimeType,
            },
          ],
          generation_config: { max_output_tokens: 16_384 },
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: responseSchema,
          },
        },
        {
          timeout: DEADLINE_MS,
          maxRetries: 0,
          fetchOptions: { signal: controller.signal },
        },
      ),
      deadline,
    ]);
    if (
      response.status !== "completed" ||
      response.errors?.length ||
      response.steps?.some((step) => step.type === "model_output" && step.error)
    )
      throw invalidOutput();
    let json: unknown;
    try {
      json = JSON.parse(response.output_text ?? "");
    } catch {
      throw invalidOutput();
    }
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) throw invalidOutput();
    const { hasSpeech, speakers, segments } = parsed.data;
    if (!hasSpeech) {
      if (speakers.length || segments.length) throw invalidOutput();
      throw new ApiError(
        "NO_SPEECH",
        "No speech was detected. Check the recording and try another file.",
        422,
      );
    }
    const transcript = transcriptSchema.safeParse({
      durationSeconds: audio.durationSeconds,
      speakers,
      segments,
    });
    if (!transcript.success) throw invalidOutput();
    return {
      transcript: transcript.data,
      model: response.model ?? model,
      promptVersion: TRANSCRIPTION_PROMPT_VERSION,
    };
  } catch (error) {
    throw providerFailure(error);
  } finally {
    clearTimeout(timer);
  }
}
