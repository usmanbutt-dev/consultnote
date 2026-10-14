import { expect, it } from "vitest";
import { downloadFilename, toPlainText } from "@/lib/downloads";
import { consultationRecordSchema } from "@/lib/consultation";
import transcript from "../fixtures/transcript.json";
import notes from "../fixtures/notes.json";

it.each([
  [
    "Mr. Jones – Back pain – 14 Oct 2026",
    "Mr. Jones – Back pain – 14 Oct 2026.txt",
  ],
  ["  Follow-up: back / shoulder?  ", "Follow-up back shoulder.txt"],
  ["Dr. José – Follow-up", "Dr. José – Follow-up.txt"],
  ["CON", "Consultation - CON.txt"],
  ["NUL.notes", "Consultation - NUL.notes.txt"],
  ["...   ", "Consultation.txt"],
])("makes a readable, safe filename for %s", (title, expected) => {
  expect(downloadFilename(title, "txt")).toBe(expected);
});

it("keeps Unicode filenames short enough for common filesystems", () => {
  const name = downloadFilename("مریض".repeat(60), "txt");
  expect(Buffer.byteLength(name)).toBeLessThanOrEqual(200);
  expect(name).not.toContain("\uFFFD");
  expect(name).toMatch(/\.txt$/);
});

it("exports editable notes without Markdown markup or a full transcript", () => {
  const record = consultationRecordSchema.parse({
    id: "9d617a5e-8818-4abb-a18a-04afbdce3757",
    title: "Back pain follow-up",
    createdAt: "2026-10-13T12:00:00.000Z",
    updatedAt: "2026-10-14T12:00:00.000Z",
    transcript,
    assignments: [
      { speakerId: "speaker-1", role: "doctor" },
      { speakerId: "speaker-2", role: "patient" },
    ],
    notesResult: { notes, sourceDigest: "a".repeat(64) },
    model: "test-model",
    promptVersion: "sample-v1/test",
  });
  const text = toPlainText(record);
  expect(text).toContain("Back pain follow-up");
  expect(text).toContain("Prepared fictional sample");
  expect(text).toContain("History\n- Patient reported headaches");
  expect(text).toContain("Follow-up\n- Follow-up conversation proposed");
  expect(text).not.toContain(transcript.segments[0].text);
  expect(text).not.toContain("test-model");
  expect(text).not.toContain("(#segment-");
});
