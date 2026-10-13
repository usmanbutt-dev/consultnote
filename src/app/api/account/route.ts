import {
  assertAccountOrigin,
  readDoctorProfile,
  updateProfile,
  removeAccount,
} from "@/lib/account-server";
import { requireSignedInUser } from "@/lib/supabase/server";
import { readJsonRequest, errorResponse } from "@/lib/http";

export async function GET() {
  try {
    return Response.json(await readDoctorProfile(await requireSignedInUser()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    assertAccountOrigin(request);
    return Response.json(await updateProfile(await readJsonRequest(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertAccountOrigin(request);
    await removeAccount(await readJsonRequest(request));
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
