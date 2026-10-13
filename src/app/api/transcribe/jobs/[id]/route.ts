import { requireOwner } from "@/lib/supabase/server";
import { pollJob, cancelJob } from "@/lib/cloud-jobs";
import { ApiError, errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
async function ownerId() {
  const owner = await requireOwner();
  if (!owner)
    throw new ApiError(
      "CONFIGURATION_REQUIRED",
      "Background transcription needs Supabase setup.",
      503,
    );
  return owner.userId;
}
export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(
      await pollJob(await ownerId(), (await context.params).id),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    await cancelJob(await ownerId(), (await context.params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
