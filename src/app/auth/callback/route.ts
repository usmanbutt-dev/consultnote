import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destination =
    url.searchParams.get("next") === "/reset-password"
      ? "/reset-password"
      : "/";
  try {
    if (code) {
      const { error } = await (
        await serverSupabase()
      ).auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL(destination, url.origin));
    }
  } catch {
    /* Expired or unavailable links return to sign-in. */
  }
  return NextResponse.redirect(new URL("/login?recovery=expired", url.origin));
}
