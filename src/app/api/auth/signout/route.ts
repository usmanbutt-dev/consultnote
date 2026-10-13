import { serverSupabase, clearAuthCookies } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/http";
import { assertAccountOrigin } from "@/lib/account-server";

export async function POST(request: Request) {
  try {
    assertAccountOrigin(request);
    const client = await serverSupabase();
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      // Local sign-out still clears this browser if the auth service is unavailable.
    } finally {
      await clearAuthCookies();
    }
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
