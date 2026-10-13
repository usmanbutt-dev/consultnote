import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createConsultation,
  listConsultations,
  getConsultation,
  updateConsultation,
  deleteConsultation,
} from "@/lib/db";
import { transcriptSchema, notesSchema } from "@/lib/consultation";
import { sourceDigest } from "@/lib/evidence";
import rawTranscript from "../fixtures/transcript.json";
import rawNotes from "../fixtures/notes.json";
vi.mock("server-only", () => ({}));
const transcript = transcriptSchema.parse(rawTranscript);
const assignments = transcript.speakers.map((s) => ({
  speakerId: s.id,
  role: s.suggestedRole,
}));
const input = {
  title: "Fictional follow-up",
  transcript,
  assignments,
  notesResult: {
    notes: notesSchema.parse(rawNotes),
    sourceDigest: sourceDigest(transcript, assignments),
  },
  model: "test-model",
  promptVersion: "test-v1",
};
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "consultnote-db-"));
  vi.stubEnv("DATABASE_PATH", join(directory, "test.sqlite"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
it("creates, lists and reopens a complete record without storing audio", () => {
  const record = createConsultation(input);
  expect(record.id).toMatch(/^[a-f0-9-]{36}$/);
  expect(record.createdAt).toBe(record.updatedAt);
  expect(getConsultation(record.id)).toEqual(record);
  expect(listConsultations()).toEqual([
    {
      id: record.id,
      title: input.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  ]);
  expect(JSON.stringify(record)).not.toMatch(/audioBlob|base64|audioBytes/);
});
it("updates the same ID, preserves creation time and sorts by latest update", () => {
  const first = createConsultation(input);
  const second = createConsultation({ ...input, title: "Second" });
  const updated = updateConsultation(first.id, { ...input, title: "Renamed" });
  expect(updated).toMatchObject({
    id: first.id,
    createdAt: first.createdAt,
    title: "Renamed",
  });
  expect(updated!.updatedAt > first.updatedAt).toBe(true);
  expect(listConsultations().map((r) => r.id)).toEqual([first.id, second.id]);
});
it("deletes only the requested consultation and reports missing IDs", () => {
  const first = createConsultation(input);
  const second = createConsultation(input);
  expect(deleteConsultation(first.id)).toBe(true);
  expect(getConsultation(first.id)).toBeNull();
  expect(deleteConsultation(first.id)).toBe(false);
  expect(updateConsultation(first.id, input)).toBeNull();
  expect(getConsultation(second.id)).not.toBeNull();
});
it("rejects stale evidence digests before inserting or overwriting a record", () => {
  const existing = createConsultation(input);
  const stale = {
    ...input,
    transcript: {
      ...transcript,
      segments: transcript.segments.map((s, i) =>
        i === 0 ? { ...s, text: "Corrected" } : s,
      ),
    },
  };
  expect(() => createConsultation(stale)).toThrow(/notes|changed|regenerate/i);
  expect(() => updateConsultation(existing.id, stale)).toThrow();
  expect(getConsultation(existing.id)).toEqual(existing);
  expect(listConsultations()).toHaveLength(1);
});
it.each(["not-a-uuid", "../secret", "123"])("rejects malformed ID %s", (id) => {
  expect(() => getConsultation(id)).toThrow();
  expect(() => deleteConsultation(id)).toThrow();
  expect(() => updateConsultation(id, input)).toThrow();
});
it("round trips quoted titles and plain text without SQL interpretation", () => {
  const title = "Robert'); DROP TABLE consultations;-- <script>";
  const record = createConsultation({ ...input, title });
  expect(getConsultation(record.id)?.title).toBe(title);
  expect(listConsultations()).toHaveLength(1);
});
it("maps storage failures without exposing filesystem details", () => {
  const file = join(directory, "not-a-directory");
  writeFileSync(file, "occupied");
  vi.stubEnv("DATABASE_PATH", join(file, "db.sqlite"));
  try {
    listConsultations();
    throw new Error("Expected failure");
  } catch (error) {
    expect(error).toMatchObject({ code: "STORAGE_FAILED", status: 500 });
    expect((error as Error).message).not.toContain(directory);
  }
});
