import { createConsultation, listConsultations } from "@/lib/db";
import { consultationInputSchema } from "@/lib/consultation";
import { ApiError, errorResponse, readJsonRequest } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  try {
    return Response.json({ consultations: listConsultations() });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = consultationInputSchema.safeParse(
      await readJsonRequest(request),
    );
    if (!parsed.success)
      throw new ApiError(
        "INVALID_INPUT",
        "Review the consultation before saving.",
        400,
      );
    return Response.json(createConsultation(parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
