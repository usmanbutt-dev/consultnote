import "server-only";
import * as local from "./db";
import {
  consultationRecordSchema,
  consultationSummarySchema,
  type ConsultationInput,
} from "./consultation";
import { requireOwner } from "./supabase/server";
import { ApiError } from "./http";

function storageError() {
  return new ApiError(
    "STORAGE_FAILED",
    "The consultation could not be stored or read. Your current draft is still available.",
    503,
  );
}
function record(row: {
  id: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
}) {
  return consultationRecordSchema.parse({
    ...(row.payload as ConsultationInput),
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}
export async function listConsultations() {
  const owner = await requireOwner();
  if (!owner) return local.listConsultations();
  const { data, error } = await owner.client
    .from("consultations")
    .select("id,title,created_at,updated_at")
    .eq("user_id", owner.userId)
    .order("updated_at", { ascending: false });
  if (error) throw storageError();
  return (data ?? []).map((row) =>
    consultationSummarySchema.parse({
      id: row.id,
      title: row.title,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }),
  );
}
export async function getConsultation(id: string) {
  local.validateConsultationId(id);
  const owner = await requireOwner();
  if (!owner) return local.getConsultation(id);
  const { data, error } = await owner.client
    .from("consultations")
    .select("id,payload,created_at,updated_at")
    .eq("user_id", owner.userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw storageError();
  return data ? record(data) : null;
}
export async function createConsultation(input: ConsultationInput) {
  const owner = await requireOwner();
  if (!owner) return local.createConsultation(input);
  const payload = local.validateInput(input);
  const { data, error } = await owner.client
    .from("consultations")
    .insert({ user_id: owner.userId, title: payload.title, payload })
    .select("id,payload,created_at,updated_at")
    .single();
  if (error || !data) throw storageError();
  return record(data);
}
export async function updateConsultation(id: string, input: ConsultationInput) {
  local.validateConsultationId(id);
  const owner = await requireOwner();
  if (!owner) return local.updateConsultation(id, input);
  const payload = local.validateInput(input);
  const { data, error } = await owner.client
    .from("consultations")
    .update({ title: payload.title, payload })
    .eq("user_id", owner.userId)
    .eq("id", id)
    .select("id,payload,created_at,updated_at")
    .maybeSingle();
  if (error) throw storageError();
  return data ? record(data) : null;
}
export async function deleteConsultation(id: string) {
  local.validateConsultationId(id);
  const owner = await requireOwner();
  if (!owner) return local.deleteConsultation(id);
  const { data, error } = await owner.client
    .from("consultations")
    .delete()
    .eq("user_id", owner.userId)
    .eq("id", id)
    .select("id");
  if (error) throw storageError();
  return Boolean(data?.length);
}
