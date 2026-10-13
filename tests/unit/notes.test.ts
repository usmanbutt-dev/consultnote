import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateNotes, suggestRoles } from "@/lib/groq";
import { sourceDigest } from "@/lib/evidence";
import { transcriptSchema } from "@/lib/consultation";
import rawTranscript from "../fixtures/transcript.json";
import notes from "../fixtures/notes.json";

vi.mock("server-only", () => ({}));
const transcript = transcriptSchema.parse(rawTranscript);
const assignments = transcript.speakers.map((s) => ({
  speakerId: s.id,
  role: s.suggestedRole as "doctor" | "patient",
}));
beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "private-groq-key");
  vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function completion(value: unknown, finish_reason = "stop") {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({
      choices: [{ finish_reason, message: { content: JSON.stringify(value) } }],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
it("returns grounded notes with a digest of reviewed roles and the unchanged transcript", async () => {
  const fetch = completion(notes);
  const result = await generateNotes(transcript, assignments);
  expect(result).toEqual({
    notes,
    sourceDigest: sourceDigest(transcript, assignments),
  });
  const sent = JSON.parse(fetch.mock.calls[0][1]!.body as string);
  expect(sent.messages[0].content).toMatch(/untrusted|instructions/i);
  expect(sent.messages[1].content).toContain("segment-2");
  expect(sent.response_format).toMatchObject({
    type: "json_schema",
    json_schema: {
      strict: true,
      schema: { type: "object", additionalProperties: false },
    },
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("rejects notes whose evidence is outside the reviewed transcript", async () => {
  completion({
    sections: [
      {
        kind: "discussion",
        items: [{ text: "Invented", segmentIds: ["foreign"] }],
      },
    ],
  });
  await expect(generateNotes(transcript, assignments)).rejects.toMatchObject({
    code: "INVALID_AI_OUTPUT",
  });
});
it.each([
  {},
  { sections: [] },
  {
    sections: [
      {
        kind: "diagnosis",
        items: [{ text: "Fact", segmentIds: ["segment-1"] }],
      },
    ],
  },
  { sections: [notes.sections[0], notes.sections[0]] },
])("rejects an invalid notes contract", async (value) => {
  completion(value);
  await expect(generateNotes(transcript, assignments)).rejects.toMatchObject({
    code: "INVALID_AI_OUTPUT",
  });
});
it("rejects truncated output even if the JSON is parseable", async () => {
  completion(notes, "length");
  await expect(generateNotes(transcript, assignments)).rejects.toMatchObject({
    code: "INVALID_AI_OUTPUT",
  });
});
it("rejects missing role assignments before making a provider call", async () => {
  const fetch = completion(notes);
  await expect(generateNotes(transcript, [])).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  expect(fetch).not.toHaveBeenCalled();
});
it("changes the digest when a reviewed role changes", async () => {
  completion(notes);
  const changed = assignments.map((a) => ({ ...a, role: "unknown" as const }));
  const result = await generateNotes(transcript, changed);
  expect(result.sourceDigest).not.toBe(sourceDigest(transcript, assignments));
});
it("maps quota errors safely without automatic retry", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ error: { message: "private-groq-key" } }, { status: 429 }),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(generateNotes(transcript, assignments)).rejects.toMatchObject({
    code: "AI_QUOTA_EXCEEDED",
    status: 429,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("identifies provider JSON validation failure without exposing generated text", async () => {
  const fetch = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: "json_validate_failed",
          message: "private output",
          failed_generation: "private-groq-key",
        },
      },
      { status: 400 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(generateNotes(transcript, assignments)).rejects.toMatchObject({
    code: "INVALID_AI_OUTPUT",
    status: 502,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("role suggestions preserve all words, timestamps and speaker boundaries", async () => {
  const fetch = completion({
    speakers: [
      {
        id: "speaker-1",
        suggestedRole: "doctor",
        reason: "Introduces the doctor role.",
      },
      {
        id: "speaker-2",
        suggestedRole: "unknown",
        reason: "Insufficient evidence.",
      },
    ],
  });
  const result = await suggestRoles(transcript, new AbortController().signal);
  const sent = JSON.parse(fetch.mock.calls[0][1]!.body as string);
  expect(sent.max_completion_tokens).toBe(1024);
  expect(sent.messages[1].content).not.toContain("startSeconds");
  for (const segment of transcript.segments)
    expect(sent.messages[1].content).toContain(
      segment.text.replace(/"/g, '\\"'),
    );
  expect(result.segments).toEqual(transcript.segments);
  expect(result.speakers[1].suggestedRole).toBe("unknown");
});
it("rejects invented or missing speaker IDs in role suggestions", async () => {
  completion({
    speakers: [{ id: "foreign", suggestedRole: "doctor", reason: "Invented" }],
  });
  await expect(
    suggestRoles(transcript, new AbortController().signal),
  ).rejects.toMatchObject({ code: "INVALID_AI_OUTPUT" });
});
