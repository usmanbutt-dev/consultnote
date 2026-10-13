import { readAudioRequest } from "@/lib/audio";
import { transcribeAudio } from "@/lib/gemini";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const audio = await readAudioRequest(request);
    return Response.json(await transcribeAudio(audio));
  } catch (error) {
    return errorResponse(error);
  }
}
