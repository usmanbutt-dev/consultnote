import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cloudMode, supabaseConfiguration } from "./config";
import { ApiError } from "../http";

export async function serverSupabase() {
  const { url, key } = supabaseConfiguration();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        values.forEach(({ name, value, options }) => {
          try {
            jar.set(name, value, options);
          } catch {
            /* Server Components cannot set cookies; proxy refreshes them. */
          }
        });
      },
    },
  });
}

export async function requireOwner() {
  if (!cloudMode()) return null;
  const owner = await requireSignedInUser();
  if (owner.user.app_metadata.account_deleting)
    throw new ApiError(
      "ACCOUNT_DELETING",
      "Account removal is in progress. Open your profile to retry.",
      409,
    );
  return owner;
}

export async function clearAuthCookies() {
  const { url } = supabaseConfiguration();
  const prefix = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const jar = await cookies();
  for (const { name } of jar.getAll())
    if (
      name === prefix ||
      name.startsWith(`${prefix}.`) ||
      name === `${prefix}-code-verifier`
    )
      jar.delete(name);
}

export async function requireSignedInUser() {
  if (!cloudMode())
    throw new ApiError(
      "CONFIGURATION_REQUIRED",
      "Connect Supabase to enable doctor accounts.",
      503,
    );
  const client = await serverSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new ApiError("UNAUTHORIZED", "Sign in to open your workspace.", 401);
  return { client, userId: data.user.id, user: data.user };
}

export function adminSupabase() {
  const { url } = supabaseConfiguration();
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key)
    throw new ApiError(
      "CONFIGURATION_REQUIRED",
      "Cloud processing needs the Supabase server key. Complete the deployment setup.",
      503,
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function reserveProcessing(
  userId: string,
  operation: "transcribe" | "notes",
) {
  const { data, error } = await adminSupabase().rpc("reserve_ai_use", {
    owner_id: userId,
    operation_name: operation,
  });
  if (error)
    throw new ApiError(
      "STORAGE_FAILED",
      "Processing could not start. Check the cloud database setup.",
      503,
    );
  if (!data)
    throw new ApiError(
      "PROCESSING_LIMIT",
      "The demo processing limit has been reached. Try again tomorrow.",
      429,
    );
}
