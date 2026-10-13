import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { transcribeAudio, processingConfiguration } from "@/lib/ai";
import { transcribeWithAssemblyAI } from "@/lib/assemblyai";
import { suggestRoles } from "@/lib/groq";
import { transcribeAudio as gemini } from "@/lib/gemini";
import { transcriptSchema } from "@/lib/consultation";
import fixture from "../fixtures/transcript.json";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/assemblyai", () => ({ transcribeWithAssemblyAI: vi.fn() }));
vi.mock("@/lib/groq", () => ({
  suggestRoles: vi.fn(),
  groqModel: () => "openai/gpt-oss-20b",
}));
vi.mock("@/lib/gemini", () => ({ transcribeAudio: vi.fn() }));
const transcript = transcriptSchema.parse(fixture);
const audio = {
  bytes: new Uint8Array([1]),
  mimeType: "audio/wav",
  durationSeconds: 90,
};
beforeEach(() => {
  vi.stubEnv("TRANSCRIPTION_PROVIDER", "assemblyai");
  vi.stubEnv("ASSEMBLYAI_API_KEY", "test");
  vi.mocked(transcribeWithAssemblyAI).mockReset();
  vi.mocked(suggestRoles).mockReset();
  vi.mocked(gemini).mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("honors an explicit Gemini selection instead of silently switching providers", async () => {
  vi.stubEnv("TRANSCRIPTION_PROVIDER", "gemini");
  vi.mocked(gemini).mockResolvedValue({
    transcript,
    model: "gemini-model",
    promptVersion: "transcribe-v1",
  });
  await transcribeAudio(audio);
  expect(gemini).toHaveBeenCalledTimes(1);
  expect(transcribeWithAssemblyAI).not.toHaveBeenCalled();
  expect(processingConfiguration().provider).toBe("gemini");
});
it("keeps the actual transcript available with unknown roles when role inference fails", async () => {
  const unknown = {
    ...transcript,
    speakers: transcript.speakers.map((s) => ({
      ...s,
      suggestedRole: "unknown" as const,
    })),
  };
  vi.mocked(transcribeWithAssemblyAI).mockResolvedValue({
    transcript: unknown,
    model: "AssemblyAI:test",
  });
  vi.mocked(suggestRoles).mockRejectedValue(
    new Error("private provider detail"),
  );
  const result = await transcribeAudio(audio);
  expect(result.transcript.segments).toEqual(transcript.segments);
  expect(
    result.transcript.speakers.every(
      (s) => s.suggestedRole === "unknown" && s.reason.includes("manually"),
    ),
  ).toBe(true);
  expect(gemini).not.toHaveBeenCalled();
});
it("limits optional role inference to 15 seconds without losing completed transcription", async () => {
  vi.useFakeTimers();
  vi.mocked(transcribeWithAssemblyAI).mockResolvedValue({
    transcript,
    model: "AssemblyAI:test",
  });
  vi.mocked(suggestRoles).mockImplementation(() => new Promise(() => {}));
  let done = false;
  const pending = transcribeAudio(audio).then((result) => {
    done = true;
    return result;
  });
  await vi.advanceTimersByTimeAsync(15000);
  expect(done).toBe(true);
  expect((await pending).transcript.segments).toEqual(transcript.segments);
});
it("enforces the overall transcription deadline and never retries generation", async () => {
  vi.useFakeTimers();
  vi.mocked(transcribeWithAssemblyAI).mockImplementation(
    () => new Promise(() => {}),
  );
  const pending = transcribeAudio(audio);
  const result = pending.catch((error) => error);
  await vi.advanceTimersByTimeAsync(120000);
  expect(await result).toMatchObject({ code: "AI_TIMEOUT", status: 504 });
  expect(transcribeWithAssemblyAI).toHaveBeenCalledTimes(1);
  expect(suggestRoles).not.toHaveBeenCalled();
});
