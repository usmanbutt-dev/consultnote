import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  transcribeWithAssemblyAI,
  submitAssemblyJob,
  pollAssemblyJob,
} from "@/lib/assemblyai";

vi.mock("server-only", () => ({}));
const audio = {
  bytes: new Uint8Array([1, 2]),
  mimeType: "audio/wav",
  durationSeconds: 30,
};
const completed = {
  status: "completed",
  speech_model_used: "universal-3-pro",
  text: "Hello. Hi.",
  utterances: [
    {
      speaker: "A",
      start: 0,
      end: 1000,
      text: "Hello.",
      translated_texts: { en: "Hello." },
    },
    {
      speaker: "B",
      start: 1200,
      end: 2000,
      text: "Hi.",
      translated_texts: { en: "Hi." },
    },
  ],
};
beforeEach(() => vi.stubEnv("ASSEMBLYAI_API_KEY", "private-test-key"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function responses(...values: unknown[]) {
  const fetch = vi.fn();
  values.forEach((value) => fetch.mockResolvedValueOnce(Response.json(value)));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
it("submits once and maps diarized utterances to measured seconds and stable speaker IDs", async () => {
  const fetch = responses(
    { upload_url: "https://cdn.assemblyai.com/upload/test" },
    { id: "job-1" },
    completed,
  );
  const result = await transcribeWithAssemblyAI(
    audio,
    new AbortController().signal,
  );
  expect(result.model).toContain("universal-3-pro");
  expect(result.transcript).toMatchObject({
    durationSeconds: 30,
    speakers: [
      { id: "speaker-1", suggestedRole: "unknown" },
      { id: "speaker-2", suggestedRole: "unknown" },
    ],
    segments: [
      {
        id: "segment-1",
        speakerId: "speaker-1",
        startSeconds: 0,
        endSeconds: 1,
        text: "Hello.",
      },
      {
        id: "segment-2",
        speakerId: "speaker-2",
        startSeconds: 1.2,
        endSeconds: 2,
        text: "Hi.",
      },
    ],
  });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
    speaker_labels: true,
    language_detection: true,
    speech_models: ["universal-2"],
    language_detection_options: { code_switching: true },
    speech_understanding: {
      request: {
        translation: {
          target_languages: ["en"],
          match_original_utterance: true,
          force_translation: true,
        },
      },
    },
  });
});
it("polls an existing queued job without submitting another generation", async () => {
  vi.useFakeTimers();
  const fetch = responses(
    { upload_url: "https://cdn.assemblyai.com/upload/test" },
    { id: "job-1" },
    {
      status: "processing",
      speech_model_used: null,
      text: null,
      utterances: null,
    },
    completed,
  );
  const pending = transcribeWithAssemblyAI(audio, new AbortController().signal);
  const assertion = expect(pending).resolves.toMatchObject({
    transcript: { segments: expect.any(Array) },
  });
  await vi.advanceTimersByTimeAsync(2000);
  await assertion;
  expect(
    fetch.mock.calls.filter(
      (call) => call[0] === "https://api.assemblyai.com/v2/transcript",
    ),
  ).toHaveLength(1);
});
it.each(["auto", "ur", "en-ur"] as const)(
  "renders %s speech in English without changing speaker attribution or timing",
  async (language) => {
    const fetch = responses(
      { upload_url: "https://cdn.assemblyai.com/upload/test" },
      { id: "job-1" },
      {
        ...completed,
        text: "مجھے بخار ہے",
        utterances: [
          {
            speaker: "A",
            start: 0,
            end: 1000,
            text: "مجھے بخار ہے",
            translated_texts: { en: "I have a fever." },
          },
        ],
      },
    );
    const result = await transcribeWithAssemblyAI(
      audio,
      new AbortController().signal,
      language,
    );
    const sent = JSON.parse(fetch.mock.calls[1][1].body);
    expect(sent.speech_models).toEqual(["universal-2"]);
    if (language === "ur") expect(sent.language_code).toBe("ur");
    else
      expect(sent.language_detection_options).toEqual({ code_switching: true });
    expect(result.transcript.segments[0]).toMatchObject({
      id: "segment-1",
      speakerId: "speaker-1",
      startSeconds: 0,
      endSeconds: 1,
      text: "I have a fever.",
    });
  },
);
it("rejects a completed job with missing English translation instead of displaying Urdu", async () => {
  responses({
    status: "completed",
    text: "مجھے بخار ہے",
    utterances: [{ speaker: "A", start: 0, end: 1000, text: "مجھے بخار ہے" }],
  });
  await expect(
    pollAssemblyJob("job-1", 30, new AbortController().signal),
  ).rejects.toMatchObject({ code: "INVALID_AI_OUTPUT" });
});
it.each([401, 403, 429, 503])(
  "maps HTTP %i without leaking credentials or provider bodies",
  async (status) => {
    const fetch = vi.fn(async () =>
      Response.json(
        { error: "private-test-key private provider detail" },
        { status },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      transcribeWithAssemblyAI(audio, new AbortController().signal),
    ).rejects.toMatchObject({
      code:
        status === 429
          ? "AI_QUOTA_EXCEEDED"
          : status === 503
            ? "AI_UNAVAILABLE"
            : "AI_AUTH_FAILED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
it("rejects provider timestamps beyond the recording", async () => {
  responses(
    { upload_url: "https://cdn.assemblyai.com/upload/test" },
    { id: "job-1" },
    {
      ...completed,
      utterances: [{ speaker: "A", start: 0, end: 35000, text: "Hello" }],
    },
  );
  await expect(
    transcribeWithAssemblyAI(audio, new AbortController().signal),
  ).rejects.toMatchObject({ code: "INVALID_AI_OUTPUT" });
});
it("distinguishes silence from malformed diarization", async () => {
  responses(
    { upload_url: "https://cdn.assemblyai.com/upload/test" },
    { id: "job-1" },
    { status: "completed", text: "", utterances: [] },
  );
  await expect(
    transcribeWithAssemblyAI(audio, new AbortController().signal),
  ).rejects.toMatchObject({ code: "NO_SPEECH" });
});
it("cloud submission creates one job from a validated private URL", async () => {
  const fetch = responses({ id: "cloud-job" });
  expect(
    await submitAssemblyJob(
      "https://example.supabase.co/private/audio",
      new AbortController().signal,
      "en-ur",
    ),
  ).toBe("cloud-job");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    audio_url: "https://example.supabase.co/private/audio",
    speech_models: ["universal-2"],
  });
});
it("cloud polling returns pending immediately without resubmission", async () => {
  const fetch = responses({ status: "processing", text: null });
  expect(
    await pollAssemblyJob("cloud-job", 30, new AbortController().signal),
  ).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(
    "https://api.assemblyai.com/v2/transcript/cloud-job",
  );
});
