import "server-only";
import { z } from "zod";
import { ApiError, readBoundedBody } from "./http";
import { serverSupabase } from "./supabase/server";
import { validateAudioBytes } from "./audio";

export const AUDIO_BUCKET = "consultation-audio";
export function validateAudioPath(path: string, userId: string): string {
  const [owner, filename, extra] = path.split("/");
  const match = filename?.match(/^([0-9a-f-]{36})\.(mp3|wav|webm|ogg)$/i);
  if (
    owner !== userId ||
    extra !== undefined ||
    !match ||
    !z.uuid().safeParse(match[1]).success
  )
    throw new ApiError(
      "NOT_FOUND",
      "The recording could not be found in your workspace.",
      404,
    );
  return path;
}
export async function storedAudio(path: string, userId: string) {
  validateAudioPath(path, userId);
  const client = await serverSupabase();
  const { data, error } = await client.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data)
    throw new ApiError(
      "NOT_FOUND",
      "The recording could not be found. Upload it again.",
      404,
    );
  const response = await fetch(data.signedUrl, {
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new ApiError(
      "NOT_FOUND",
      "The recording could not be read. Upload it again.",
      404,
    );
  const bytes = await readBoundedBody(
    new Request("https://audio.internal", {
      method: "POST",
      body: response.body,
      duplex: "half",
    } as RequestInit),
    10 * 1024 * 1024,
  );
  return { audio: await validateAudioBytes(bytes), url: data.signedUrl };
}
export async function removeStoredAudio(path: string, userId: string) {
  validateAudioPath(path, userId);
  await (await serverSupabase()).storage.from(AUDIO_BUCKET).remove([path]);
}
