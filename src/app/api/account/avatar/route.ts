import {
  assertAccountOrigin,
  readDoctorProfile,
  uploadAvatar,
  removeAvatar,
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
} from "@/lib/account-server";
import { avatarPath } from "@/lib/account";
import { requireOwner } from "@/lib/supabase/server";
import { ApiError, errorResponse, readBoundedBody } from "@/lib/http";

export async function GET() {
  try {
    const owner = await requireOwner();
    if (!owner)
      throw new ApiError("UNAUTHORIZED", "Sign in to view your photo.", 401);
    const profile = await readDoctorProfile(owner);
    if (!profile.avatarPath)
      throw new ApiError("NOT_FOUND", "No profile photo has been added.", 404);
    const { data, error } = await owner.client.storage
      .from(AVATAR_BUCKET)
      .download(avatarPath(profile.avatarPath, owner.userId));
    if (error || !data)
      throw new ApiError("NOT_FOUND", "Your photo could not be read.", 404);
    return new Response(data, {
      headers: {
        "Content-Type": data.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    assertAccountOrigin(request);
    if (!(await requireOwner()))
      throw new ApiError("UNAUTHORIZED", "Sign in to change your photo.", 401);
    const bytes = await readBoundedBody(
      request,
      MAX_AVATAR_BYTES,
      new ApiError("INVALID_INPUT", "Choose a photo smaller than 2 MB.", 413),
    );
    return Response.json(await uploadAvatar(bytes));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertAccountOrigin(request);
    return Response.json(await removeAvatar());
  } catch (error) {
    return errorResponse(error);
  }
}
