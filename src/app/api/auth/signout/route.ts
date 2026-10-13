import { requireOwner } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    const owner = await requireOwner();
    if (owner) await owner.client.auth.signOut();
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
