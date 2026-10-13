import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  consultationInputSchema,
  consultationRecordSchema,
  consultationSummarySchema,
  type ConsultationInput,
  type ConsultationRecord,
  type ConsultationSummary,
} from "./consultation";
import { sourceDigest } from "./evidence";
import { ApiError } from "./http";

export function validateConsultationId(id: string): void {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError("INVALID_INPUT", "Choose a valid consultation ID.", 400);
}
function validateInput(input: ConsultationInput): ConsultationInput {
  const parsed = consultationInputSchema.safeParse(input);
  if (!parsed.success)
    throw new ApiError(
      "INVALID_INPUT",
      "Review the consultation title, transcript, roles and note sources.",
      400,
    );
  if (
    parsed.data.notesResult.sourceDigest !==
    sourceDigest(parsed.data.transcript, parsed.data.assignments)
  )
    throw new ApiError(
      "INVALID_INPUT",
      "The transcript or roles changed. Regenerate notes before saving.",
      400,
    );
  return parsed.data;
}
function withDatabase<T>(work: (db: DatabaseSync) => T): T {
  let db: DatabaseSync | undefined;
  try {
    const path = resolve(
      /*turbopackIgnore: true*/
      process.env.DATABASE_PATH?.trim() || ".data/consultnote.sqlite",
    );
    mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE IF NOT EXISTS consultations (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)",
    );
    return work(db);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "STORAGE_FAILED",
      "The consultation could not be stored or read. Your current draft is still available.",
      500,
    );
  } finally {
    db?.close();
  }
}
function readRecord(db: DatabaseSync, id: string): ConsultationRecord | null {
  const row = db
    .prepare("SELECT payload_json FROM consultations WHERE id = ?")
    .get(id);
  return row
    ? consultationRecordSchema.parse(JSON.parse(row.payload_json as string))
    : null;
}
export function createConsultation(
  input: ConsultationInput,
): ConsultationRecord {
  const validated = validateInput(input);
  const now = new Date().toISOString();
  const record = {
    ...validated,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  return withDatabase((db) => {
    db.prepare(
      "INSERT INTO consultations (id,title,created_at,updated_at,payload_json) VALUES (?,?,?,?,?)",
    ).run(record.id, record.title, now, now, JSON.stringify(record));
    return record;
  });
}
export function listConsultations(): ConsultationSummary[] {
  return withDatabase((db) =>
    db
      .prepare(
        "SELECT id,title,created_at AS createdAt,updated_at AS updatedAt FROM consultations ORDER BY updated_at DESC, id",
      )
      .all()
      .map((row) => consultationSummarySchema.parse(row)),
  );
}
export function getConsultation(id: string): ConsultationRecord | null {
  validateConsultationId(id);
  return withDatabase((db) => readRecord(db, id));
}
export function updateConsultation(
  id: string,
  input: ConsultationInput,
): ConsultationRecord | null {
  validateConsultationId(id);
  const validated = validateInput(input);
  return withDatabase((db) => {
    const previous = readRecord(db, id);
    if (!previous) return null;
    const record = {
      ...validated,
      id,
      createdAt: previous.createdAt,
      updatedAt: new Date(
        Math.max(Date.now(), Date.parse(previous.updatedAt) + 1),
      ).toISOString(),
    };
    db.prepare(
      "UPDATE consultations SET title = ?,updated_at = ?,payload_json = ? WHERE id = ?",
    ).run(record.title, record.updatedAt, JSON.stringify(record), id);
    return record;
  });
}
export function deleteConsultation(id: string): boolean {
  validateConsultationId(id);
  return withDatabase(
    (db) =>
      db.prepare("DELETE FROM consultations WHERE id = ?").run(id).changes > 0,
  );
}
