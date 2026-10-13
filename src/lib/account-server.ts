import "server-only";
import { createClient } from "@supabase/supabase-js";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import {
  avatarPath,
  doctorProfileSchema,
  profileInputSchema,
  deleteAccountSchema,
  type DoctorProfile,
} from "./account";
import {
  adminSupabase,
  requireSignedInUser,
  requireOwner,
  clearAuthCookies,
} from "./supabase/server";
import { supabaseConfiguration } from "./supabase/config";
import { ApiError } from "./http";

export const AVATAR_BUCKET = "doctor-avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
type Owner = Awaited<ReturnType<typeof requireSignedInUser>>;
const columns = "full_name,specialty,clinic,avatar_path,deleting_at";
function unavailable(
  message = "Your account could not be updated. Please retry.",
) {
  return new ApiError("STORAGE_FAILED", message, 503);
}
export function assertAccountOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new ApiError(
      "INVALID_INPUT",
      "Open this action from your ConsultNote workspace.",
      403,
    );
}
export function accountInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new ApiError(
      "INVALID_INPUT",
      "Check the form fields and try again.",
      400,
    );
  return parsed.data;
}
export async function readDoctorProfile(owner: Owner): Promise<DoctorProfile> {
  const { data, error } = await owner.client
    .from("doctor_profiles")
    .select(columns)
    .eq("id", owner.userId)
    .maybeSingle();
  if (error || !data)
    throw new ApiError(
      "CONFIGURATION_REQUIRED",
      "Doctor profiles need the account database migration. Complete Supabase setup.",
      503,
    );
  return doctorProfileSchema.parse({
    id: owner.userId,
    email: owner.user.email,
    fullName: data.full_name,
    specialty: data.specialty,
    clinic: data.clinic,
    avatarPath: data.avatar_path,
    deleting: Boolean(data.deleting_at),
  });
}
export async function updateProfile(input: unknown): Promise<DoctorProfile> {
  const owner = await requireOwner();
  if (!owner)
    throw new ApiError("UNAUTHORIZED", "Sign in to edit your profile.", 401);
  const next = accountInput(profileInputSchema, input);
  const { data, error } = await owner.client
    .from("doctor_profiles")
    .update({
      full_name: next.fullName,
      specialty: next.specialty,
      clinic: next.clinic,
    })
    .eq("id", owner.userId)
    .is("deleting_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) throw unavailable();
  return readDoctorProfile(owner);
}
export async function validateAvatar(bytes: Uint8Array) {
  if (bytes.length > MAX_AVATAR_BYTES)
    throw new ApiError(
      "INVALID_INPUT",
      "Choose a photo smaller than 2 MB.",
      413,
    );
  const type = await fileTypeFromBuffer(bytes).catch(() => undefined);
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime))
    throw new ApiError(
      "INVALID_INPUT",
      "Choose a JPG, PNG or WebP photo.",
      400,
    );
  return { extension: type.ext === "jpeg" ? "jpg" : type.ext, mime: type.mime };
}
export async function uploadAvatar(bytes: Uint8Array): Promise<DoctorProfile> {
  const owner = await requireOwner();
  if (!owner)
    throw new ApiError("UNAUTHORIZED", "Sign in to change your photo.", 401);
  const type = await validateAvatar(bytes);
  const previous = await readDoctorProfile(owner);
  const admin = adminSupabase();
  const path = `${owner.userId}/${crypto.randomUUID()}.${type.extension}`;
  const storage = owner.client.storage.from(AVATAR_BUCKET);
  const upload = await storage.upload(path, bytes, {
    contentType: type.mime,
    upsert: false,
  });
  if (upload.error)
    throw unavailable(
      "Your photo could not be uploaded. The previous photo was kept.",
    );
  const { data, error } = await admin
    .from("doctor_profiles")
    .update({ avatar_path: path })
    .eq("id", owner.userId)
    .is("deleting_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    await storage.remove([path]).catch(() => {});
    throw unavailable("Your photo could not be saved. Please retry.");
  }
  if (previous.avatarPath)
    await storage
      .remove([avatarPath(previous.avatarPath, owner.userId)])
      .catch(() => {});
  return readDoctorProfile(owner);
}
async function clearOwnedStorage(
  admin: ReturnType<typeof adminSupabase>,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<void> {
  if (depth > 8)
    throw unavailable(
      "Account cleanup needs another attempt. Please retry removal.",
    );
  for (let pass = 0; pass < 20; pass++) {
    const storage = admin.storage.from(bucket);
    const { data, error } = await storage.list(prefix, { limit: 100 });
    if (error || !data)
      throw unavailable(
        "Account cleanup did not finish. Please retry removal.",
      );
    if (!data.length) return;
    const files: string[] = [];
    for (const object of data) {
      if ([".", ".."].includes(object.name) || object.name.includes("/"))
        throw unavailable();
      const path = `${prefix}/${object.name}`;
      if (object.id) files.push(path);
      else await clearOwnedStorage(admin, bucket, path, depth + 1);
    }
    if (files.length && (await storage.remove(files)).error)
      throw unavailable(
        "Account cleanup did not finish. Please retry removal.",
      );
  }
  throw unavailable(
    "More files remain. Please retry account removal to finish cleanup.",
  );
}
export async function removeAvatar(): Promise<DoctorProfile> {
  const owner = await requireOwner();
  if (!owner)
    throw new ApiError("UNAUTHORIZED", "Sign in to change your photo.", 401);
  const admin = adminSupabase();
  await clearOwnedStorage(admin, AVATAR_BUCKET, owner.userId);
  const { data, error } = await admin
    .from("doctor_profiles")
    .update({ avatar_path: null })
    .eq("id", owner.userId)
    .is("deleting_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw unavailable("Photo removal did not finish. Please retry.");
  return readDoctorProfile(owner);
}
export async function removeAccount(input: unknown): Promise<void> {
  const owner = await requireSignedInUser();
  const checked = accountInput(deleteAccountSchema, input);
  const config = supabaseConfiguration();
  const verifier = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await verifier.auth.signInWithPassword({
    email: owner.user.email!,
    password: checked.password,
  });
  if (verified.error && verified.error.code !== "invalid_credentials")
    throw unavailable(
      "Your password could not be verified right now. Please retry.",
    );
  if (verified.error || verified.data.user?.id !== owner.userId)
    throw new ApiError(
      "UNAUTHORIZED",
      "The current password is incorrect. Your account was kept.",
      401,
    );
  await verifier.auth.signOut({ scope: "local" }).catch(() => {});
  const admin = adminSupabase();
  const retirement = await admin
    .from("doctor_profiles")
    .update({ deleting_at: new Date().toISOString() })
    .eq("id", owner.userId);
  if (retirement.error) throw unavailable();
  const marked = await admin.auth.admin.updateUserById(owner.userId, {
    app_metadata: { ...owner.user.app_metadata, account_deleting: true },
  });
  if (marked.error)
    throw unavailable("Account removal did not finish. Please retry.");
  const cancelled = await admin
    .from("transcription_jobs")
    .update({ status: "cancelled", result: null })
    .eq("user_id", owner.userId)
    .in("status", ["starting", "processing", "finalizing"]);
  if (cancelled.error)
    throw unavailable("Account removal did not finish. Please retry.");
  await clearOwnedStorage(admin, "consultation-audio", owner.userId);
  await clearOwnedStorage(admin, AVATAR_BUCKET, owner.userId);
  const deleted = await admin.auth.admin.deleteUser(owner.userId);
  if (deleted.error)
    throw unavailable(
      "Account removal did not finish. Please retry to finish cleanup.",
    );
  await owner.client.auth.signOut({ scope: "local" }).catch(() => {});
  await clearAuthCookies();
}
