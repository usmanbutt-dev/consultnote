import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { readAudioRequest } from "@/lib/audio";
import { audioRequest, silentWav } from "../fixtures/wav";

it.each([
  ["wav", "audio/wav"],
  ["mp3", "audio/mpeg"],
  ["webm", "audio/webm"],
  ["ogg", "audio/ogg"],
])("inspects a real synthetic %s with ffprobe", async (extension, mimeType) => {
  const bytes = await readFile(
    new URL(`../fixtures/audio/tone.${extension}`, import.meta.url),
  );
  const audio = await readAudioRequest(
    audioRequest(bytes, "application/octet-stream"),
  );
  expect(audio.mimeType).toBe(mimeType);
  expect(audio.durationSeconds).toBeGreaterThan(0.9);
  expect(audio.durationSeconds).toBeLessThan(1.3);
});

it("accepts a real silent 600-second WAV and rejects 601 seconds", async () => {
  expect(
    (await readAudioRequest(audioRequest(silentWav(600)))).durationSeconds,
  ).toBe(600);
  await expect(
    readAudioRequest(audioRequest(silentWav(601))),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

it("rejects a forged WAV header that has no readable audio", async () => {
  await expect(
    readAudioRequest(audioRequest(silentWav().slice(0, 20))),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
