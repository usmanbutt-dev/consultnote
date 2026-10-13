import { readAudioRequest } from "@/lib/audio";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const audio = await readAudioRequest(request);
    return Response.json({
      mimeType: audio.mimeType,
      durationSeconds: audio.durationSeconds,
      sizeBytes: audio.bytes.byteLength,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
