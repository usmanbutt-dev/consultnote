import { readAudioRequest } from "@/lib/audio";
import { ApiError, errorResponse, readJsonRequest } from "@/lib/http";
import { requireOwner } from "@/lib/supabase/server";
import { storedAudio, removeStoredAudio } from "@/lib/cloud-audio";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await requireOwner();
    let audio;
    if (owner) {
      const parsed = z
        .strictObject({ path: z.string() })
        .safeParse(await readJsonRequest(request));
      if (!parsed.success)
        throw new ApiError(
          "INVALID_INPUT",
          "Choose a recording from your workspace.",
          400,
        );
      try {
        audio = (await storedAudio(parsed.data.path, owner.userId)).audio;
      } catch (error) {
        await removeStoredAudio(parsed.data.path, owner.userId).catch(() => {});
        throw error;
      }
    } else audio = await readAudioRequest(request);
    return Response.json({
      mimeType: audio.mimeType,
      durationSeconds: audio.durationSeconds,
      sizeBytes: audio.bytes.byteLength,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
