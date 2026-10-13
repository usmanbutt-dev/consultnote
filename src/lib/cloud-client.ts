"use client";
import { browserSupabase } from "./supabase/browser";

export async function removeCloudAudio(path: string) {
  await browserSupabase().storage.from("consultation-audio").remove([path]);
}
export async function uploadCloudAudio(
  file: File,
  signal: AbortSignal,
): Promise<{ path: string; mimeType: string; durationSeconds: number }> {
  const client = browserSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new Error("Sign in before uploading a recording.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
    ogg: "audio/ogg",
    opus: "audio/ogg",
  };
  if (!extension || !types[extension])
    throw new Error("Choose an MP3, WAV, WebM or OGG audio file.");
  const path = `${data.user.id}/${crypto.randomUUID()}.${extension === "opus" ? "ogg" : extension}`;
  try {
    signal.throwIfAborted();
    const uploaded = await client.storage
      .from("consultation-audio")
      .upload(path, file, {
        contentType: types[extension],
        upsert: false,
        cacheControl: "0",
      });
    if (uploaded.error)
      throw new Error(
        "The recording could not be uploaded. Check your connection and retry.",
      );
    signal.throwIfAborted();
    const response = await fetch("/api/audio/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
      signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error?.message ??
          "This recording could not be checked. Upload it again.",
      );
    signal.throwIfAborted();
    return {
      path,
      mimeType: result.mimeType,
      durationSeconds: result.durationSeconds,
    };
  } catch (error) {
    await client.storage
      .from("consultation-audio")
      .remove([path])
      .catch(() => {});
    throw error;
  }
}
