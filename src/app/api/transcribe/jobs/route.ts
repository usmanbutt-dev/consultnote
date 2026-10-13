import { requireOwner } from "@/lib/supabase/server";
import { jobInputSchema, startJob } from "@/lib/cloud-jobs";
import { ApiError, errorResponse, readJsonRequest } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    if (!owner)
      throw new ApiError(
        "CONFIGURATION_REQUIRED",
        "Background transcription needs Supabase setup.",
        503,
      );
    const input = jobInputSchema.safeParse(await readJsonRequest(request));
    if (!input.success)
      throw new ApiError(
        "INVALID_INPUT",
        "Choose a recording and its language.",
        400,
      );
    return Response.json(await startJob(owner.userId, input.data), {
      status: 202,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
