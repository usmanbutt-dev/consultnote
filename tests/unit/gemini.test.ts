import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "@/lib/gemini";
import { errorResponse } from "@/lib/http";
import fixture from "../fixtures/transcript.json";

const { create, construct } = vi.hoisted(() => ({
  create: vi.fn(),
  construct: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(options: unknown) {
      construct(options);
    }
    interactions = { create };
  },
}));

const audio = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: "audio/webm",
  durationSeconds: 90,
};
function speech() {
  const { speakers, segments } = structuredClone(fixture);
  return { hasSpeech: true, speakers, segments };
}
function completed(output: unknown = speech()) {
  return {
    id: "fictional-interaction",
    status: "completed",
    model: "gemini-3.8-flash",
    output_text: JSON.stringify(output),
    steps: [],
  };
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "fictional-test-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
  create.mockReset();
  construct.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Gemini transcription boundary", () => {
  it("returns a complete validated transcript with server-measured duration", async () => {
    create.mockResolvedValue(completed());
    expect(await transcribeAudio(audio)).toEqual({
      transcript: fixture,
      model: "gemini-3.8-flash",
      promptVersion: "transcribe-v2",
    });
    expect(create).toHaveBeenCalledTimes(1);
    const [request, options] = create.mock.calls[0];
    expect(request).toMatchObject({
      model: "gemini-3.8-flash",
      stream: false,
      store: false,
      generation_config: { max_output_tokens: 16384 },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: expect.any(Object),
      },
      input: expect.arrayContaining([
        { type: "audio", data: "AQID", mime_type: "audio/webm" },
      ]),
    });
    expect(options).toMatchObject({
      timeout: 120000,
      maxRetries: 0,
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
    expect(request.previous_interaction_id).toBeUndefined();
    expect(request.tools).toBeUndefined();
    expect(construct).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "fictional-test-key",
        vertexai: false,
      }),
    );
  });

  it("preserves a third speaker and an ambiguous unknown role", async () => {
    const output = speech();
    output.speakers.push({
      id: "speaker-3",
      suggestedRole: "unknown",
      reason: "A third voice, with no clear role.",
    });
    output.segments.push({
      id: "segment-5",
      speakerId: "speaker-3",
      startSeconds: 66,
      endSeconds: 70,
      text: "I can help with transport.",
    });
    create.mockResolvedValue(completed(output));
    expect((await transcribeAudio(audio)).transcript.speakers[2]).toEqual(
      output.speakers[2],
    );
  });

  it("uses the explicitly configured model without a fallback", async () => {
    vi.stubEnv("GEMINI_MODEL", "chosen-model");
    create.mockResolvedValue({ ...completed(), model: "chosen-model" });
    expect((await transcribeAudio(audio)).model).toBe("chosen-model");
    expect(create.mock.calls[0][0].model).toBe("chosen-model");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reports silence only for an explicit, consistent no-speech result", async () => {
    create.mockResolvedValue(
      completed({ hasSpeech: false, speakers: [], segments: [] }),
    );
    await expect(transcribeAudio(audio)).rejects.toMatchObject({
      code: "NO_SPEECH",
      status: 422,
    });
  });

  it.each([
    ["empty text", { ...completed(), output_text: "" }],
    ["truncated JSON", { ...completed(), output_text: '{"hasSpeech":true' }],
    ["markdown", { ...completed(), output_text: "```json\n{}\n```" }],
    ["missing completion status", { ...completed(), status: undefined }],
    [
      "provider block",
      { ...completed(), errors: [{ message: "private blocked content" }] },
    ],
    [
      "failed output step",
      {
        ...completed(),
        steps: [{ type: "model_output", error: { code: 13 } }],
      },
    ],
  ])("rejects %s without exposing provider output", async (_name, response) => {
    create.mockResolvedValue(response);
    const result = await transcribeAudio(audio).catch(errorResponse);
    expect(result).toBeInstanceOf(Response);
    const failure = result as Response;
    expect(failure.status).toBe(502);
    expect(await failure.json()).toMatchObject({
      error: { code: "INVALID_AI_OUTPUT" },
    });
  });

  it.each([
    "incomplete",
    "budget_exceeded",
    "requires_action",
    "failed",
    "cancelled",
    "queued",
    "in_progress",
  ])("rejects status %s with no continuation", async (status) => {
    create.mockResolvedValue({ ...completed(), status });
    await expect(transcribeAudio(audio)).rejects.toMatchObject({
      code: "INVALID_AI_OUTPUT",
      status: 502,
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    "missing speaker",
    "duplicate segment",
    "nonchronological",
    "out of bounds",
    "empty speech",
    "contradictory silence",
    "invalid role",
    "model duration",
  ])("rejects %s in the returned JSON", async (kind) => {
    const output = speech();
    if (kind === "missing speaker") output.segments[0].speakerId = "missing";
    if (kind === "duplicate segment")
      output.segments[1].id = output.segments[0].id;
    if (kind === "nonchronological") output.segments[1].startSeconds = 0;
    if (kind === "nonchronological") output.segments[0].startSeconds = 1;
    if (kind === "out of bounds") output.segments[0].endSeconds = 92;
    if (kind === "empty speech") output.segments = [];
    if (kind === "contradictory silence") output.hasSpeech = false;
    if (kind === "invalid role") output.speakers[0].suggestedRole = "companion";
    create.mockResolvedValue(
      completed(
        kind === "model duration" ? { ...output, durationSeconds: 1 } : output,
      ),
    );
    await expect(transcribeAudio(audio)).rejects.toMatchObject({
      code: "INVALID_AI_OUTPUT",
      status: 502,
    });
  });

  it("reports missing configuration before constructing a provider client", async () => {
    vi.stubEnv("GEMINI_API_KEY", " ");
    await expect(transcribeAudio(audio)).rejects.toMatchObject({
      code: "AI_AUTH_FAILED",
      status: 502,
      message: expect.stringContaining("GEMINI_API_KEY"),
    });
    expect(construct).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [401, "AI_AUTH_FAILED", 502],
    [403, "AI_AUTH_FAILED", 502],
    [404, "AI_UNAVAILABLE", 503],
    [400, "AI_UNAVAILABLE", 503],
    [429, "AI_QUOTA_EXCEEDED", 429],
    [500, "AI_UNAVAILABLE", 503],
    [503, "AI_UNAVAILABLE", 503],
    [408, "AI_TIMEOUT", 504],
    [504, "AI_TIMEOUT", 504],
  ])(
    "maps provider status %s to a safe public error",
    async (status, code, publicStatus) => {
      create.mockRejectedValue(
        Object.assign(new Error("fictional-test-key private patient text"), {
          status,
        }),
      );
      const response = (await transcribeAudio(audio).catch(
        errorResponse,
      )) as Response;
      expect(response.status).toBe(publicStatus);
      const body = await response.json();
      expect(body.error.code).toBe(code);
      expect(JSON.stringify(body)).not.toMatch(
        /fictional-test-key|private patient text/,
      );
      expect(create).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "RequestTimeoutError",
    "TimeoutError",
    "AbortError",
    "ConnectionError",
  ])("maps transport %s safely", async (name) => {
    create.mockRejectedValue(
      Object.assign(new Error("private transport details"), { name }),
    );
    await expect(transcribeAudio(audio)).rejects.toMatchObject({
      code: name === "ConnectionError" ? "AI_UNAVAILABLE" : "AI_TIMEOUT",
      status: name === "ConnectionError" ? 503 : 504,
    });
  });

  it("recognizes an invalid API key reported as a provider 400", async () => {
    create.mockRejectedValue(
      Object.assign(new Error("API_KEY_INVALID private-key"), { status: 400 }),
    );
    await expect(transcribeAudio(audio)).rejects.toMatchObject({
      code: "AI_AUTH_FAILED",
      status: 502,
    });
  });

  it("enforces a 120-second deadline and aborts the single outstanding call", async () => {
    vi.useFakeTimers();
    create.mockReturnValue(new Promise(() => {}));
    const pending = transcribeAudio(audio).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(120000);
    expect(await pending).toMatchObject({ code: "AI_TIMEOUT", status: 504 });
    expect(create.mock.calls[0][1].fetchOptions.signal.aborted).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
