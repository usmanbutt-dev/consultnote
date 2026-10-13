import { ApiError } from "../http";

export function cloudMode(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function supabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key)
    throw new ApiError(
      "CONFIGURATION_REQUIRED",
      "Configure Supabase before opening the hosted workspace.",
      503,
    );
  return { url, key };
}
