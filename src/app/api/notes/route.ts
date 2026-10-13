import { reviewedInputSchema } from "@/lib/consultation";
import { generateNotes } from "@/lib/groq";
import { ApiError, errorResponse, readJsonRequest } from "@/lib/http";
import { notesLanguageSchema } from "@/lib/languages";
import { requireOwner, reserveProcessing } from "@/lib/supabase/server";

const requestSchema = reviewedInputSchema.safeExtend({
  notesLanguage: notesLanguageSchema.default("en"),
});

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await requireOwner();
    const parsed = requestSchema.safeParse(await readJsonRequest(request));
    if (!parsed.success)
      throw new ApiError(
        "INVALID_INPUT",
        "Review the transcript and speaker roles before generating notes.",
        400,
      );
    if (owner) await reserveProcessing(owner.userId, "notes");
    return Response.json(
      await generateNotes(
        parsed.data.transcript,
        parsed.data.assignments,
        parsed.data.notesLanguage,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
