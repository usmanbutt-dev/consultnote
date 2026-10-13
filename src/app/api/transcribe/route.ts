import { readAudioRequest } from "@/lib/audio";
import { transcribeAudio } from "@/lib/ai";
import { ApiError, errorResponse } from "@/lib/http";
import { audioLanguageSchema } from "@/lib/languages";
import { requireOwner } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await requireOwner();
    if (owner)
      throw new ApiError(
        "INVALID_INPUT",
        "Upload through your workspace and use background transcription.",
        400,
      );
    const language = audioLanguageSchema.safeParse(
      request.headers.get("x-audio-language") ?? "auto",
    );
    if (!language.success)
      throw new ApiError(
        "INVALID_INPUT",
        "Choose a supported recording language.",
        400,
      );
    const audio = await readAudioRequest(request);
    return Response.json(await transcribeAudio(audio, language.data));
  } catch (error) {
    return errorResponse(error);
  }
}
