import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { transcribeAudio } from "@/lib/gemini";
import fixture from "../fixtures/transcript.json";

vi.mock("server-only", () => ({}));
const audio = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: "audio/webm",
  durationSeconds: 90,
};
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "fictional-transport-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("serializes one actual SDK Interactions request and reads its real response envelope", async () => {
  const requests: Request[] = [];
  const { speakers, segments } = fixture;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return Response.json({
        id: "fictional-interaction",
        object: "interaction",
        status: "completed",
        model: "gemini-3.8-flash",
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "text",
                text: JSON.stringify({ hasSpeech: true, speakers, segments }),
              },
            ],
          },
        ],
      });
    }),
  );
  expect((await transcribeAudio(audio)).transcript).toEqual(fixture);
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
  );
  expect(requests[0].headers.get("x-goog-api-key")).toBe(
    "fictional-transport-key",
  );
  expect(await requests[0].json()).toMatchObject({
    model: "gemini-3.8-flash",
    stream: false,
    store: false,
    generation_config: { max_output_tokens: 16384 },
    input: [{ type: "audio", data: "AQID", mime_type: "audio/webm" }],
    response_format: {
      mime_type: "application/json",
      schema: { properties: { hasSpeech: { type: "boolean" } } },
    },
  });
});

it("disables the real SDK's automatic retries on a quota response", async () => {
  const fetch = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: 429,
          message: "private provider response",
          status: "RESOURCE_EXHAUSTED",
        },
      },
      { status: 429 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(transcribeAudio(audio)).rejects.toMatchObject({
    code: "AI_QUOTA_EXCEEDED",
    status: 429,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("identifies a real SDK service failure without exposing provider details or retrying", async () => {
  const fetch = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: 503,
          message:
            "High demand. Private request detail: fictional-transport-key",
        },
      },
      { status: 503 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(transcribeAudio(audio)).rejects.toMatchObject({
    code: "AI_UNAVAILABLE",
    status: 503,
    message:
      "Gemini is temporarily busy or unavailable (503). Wait a moment, then retry.",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
