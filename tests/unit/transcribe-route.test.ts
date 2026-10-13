import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/transcribe/route";
import { transcribeAudio } from "@/lib/ai";
import { ApiError } from "@/lib/http";
import { audioRequest } from "../fixtures/wav";
import fixture from "../fixtures/transcript.json";
import { transcriptSchema } from "@/lib/consultation";

const transcript = transcriptSchema.parse(fixture);

vi.mock("@/lib/ai", () => ({ transcribeAudio: vi.fn() }));
beforeEach(() => {
  vi.mocked(transcribeAudio).mockReset();
});

it("validates the actual audio before asking Gemini", async () => {
  vi.mocked(transcribeAudio).mockResolvedValue({
    transcript,
    model: "fictional-model",
    promptVersion: "transcribe-v1",
  });
  const response = await POST(audioRequest());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    transcript,
    model: "fictional-model",
  });
  expect(transcribeAudio).toHaveBeenCalledWith(
    expect.objectContaining({
      mimeType: "audio/wav",
      durationSeconds: 1,
      bytes: expect.any(Uint8Array),
    }),
  );
});

it("rejects invalid audio without making a provider call", async () => {
  const response = await POST(
    audioRequest(new TextEncoder().encode("fake audio")),
  );
  expect(response.status).toBe(415);
  expect(await response.json()).toMatchObject({
    error: { code: "UNSUPPORTED_AUDIO" },
  });
  expect(transcribeAudio).not.toHaveBeenCalled();
});

it("returns a safe quota response without serializing audio or provider errors", async () => {
  vi.mocked(transcribeAudio).mockRejectedValue(
    new ApiError(
      "AI_QUOTA_EXCEEDED",
      "Gemini quota reached. Wait a moment, then retry.",
      429,
    ),
  );
  const response = await POST(audioRequest());
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({
    error: {
      code: "AI_QUOTA_EXCEEDED",
      message: "Gemini quota reached. Wait a moment, then retry.",
    },
  });
});
