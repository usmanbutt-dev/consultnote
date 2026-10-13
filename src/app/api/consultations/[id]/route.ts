import {
  getConsultation,
  updateConsultation,
  deleteConsultation,
} from "@/lib/storage";
import { validateConsultationId } from "@/lib/db";
import { consultationInputSchema } from "@/lib/consultation";
import { ApiError, errorResponse, readJsonRequest } from "@/lib/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
function missing(): ApiError {
  return new ApiError("NOT_FOUND", "This consultation was not found.", 404);
}
export async function GET(
  _request: Request,
  context: Context,
): Promise<Response> {
  try {
    const { id } = await context.params;
    const record = await getConsultation(id);
    if (!record) throw missing();
    return Response.json(record);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const { id } = await context.params;
    validateConsultationId(id);
    const parsed = consultationInputSchema.safeParse(
      await readJsonRequest(request),
    );
    if (!parsed.success)
      throw new ApiError(
        "INVALID_INPUT",
        "Review the consultation before saving.",
        400,
      );
    const record = await updateConsultation(id, parsed.data);
    if (!record) throw missing();
    return Response.json(record);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(
  _request: Request,
  context: Context,
): Promise<Response> {
  try {
    const { id } = await context.params;
    if (!(await deleteConsultation(id))) throw missing();
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
