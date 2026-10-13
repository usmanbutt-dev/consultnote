import { expect, it } from "vitest";
import { toMarkdown } from "@/lib/markdown";
import { consultationRecordSchema } from "@/lib/consultation";
import rawTranscript from "../fixtures/transcript.json";
import notes from "../fixtures/notes.json";
const record = consultationRecordSchema.parse({
  id: "9d617a5e-8818-4abb-a18a-04afbdce3757",
  title: "Reviewed consultation",
  createdAt: "2026-10-13T12:00:00.000Z",
  updatedAt: "2026-10-13T12:00:00.000Z",
  transcript: rawTranscript,
  assignments: [
    { speakerId: "speaker-1", role: "patient" },
    { speakerId: "speaker-2", role: "doctor" },
  ],
  notesResult: { notes, sourceDigest: "a".repeat(64) },
  model: "test-model",
  promptVersion: "test-v1",
});
it("exports edited roles, all note sections, evidence links and the full transcript", () => {
  const markdown = toMarkdown(record);
  expect(markdown).toContain("# Reviewed consultation");
  expect(markdown).toContain("Follow-up");
  expect(markdown).toContain("(#segment-2)");
  expect(markdown).toContain("Patient");
  for (const segment of record.transcript.segments)
    expect(markdown).toContain(segment.text);
});
it("escapes Markdown control text and HTML in user-controlled content", () => {
  const markdown = toMarkdown({
    ...record,
    title: "<script>alert(1)</script> [link](bad)",
  });
  expect(markdown).not.toContain("<script>");
  expect(markdown).not.toContain("[link](bad)");
});
