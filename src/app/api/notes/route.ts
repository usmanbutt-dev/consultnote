import { reviewedInputSchema } from "@/lib/consultation";
import { generateNotes } from "@/lib/groq";
import { ApiError, errorResponse, readJsonRequest } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = reviewedInputSchema.safeParse(
      await readJsonRequest(request),
    );
    if (!parsed.success)
      throw new ApiError(
        "INVALID_INPUT",
        "Review the transcript and speaker roles before generating notes.",
        400,
      );
    return Response.json(
      await generateNotes(parsed.data.transcript, parsed.data.assignments),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
