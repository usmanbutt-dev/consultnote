// Synthetic tones only. Run with Node.js and FFmpeg on PATH.
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

for (const [extension, codec] of [
  ["wav", "pcm_u8"],
  ["mp3", "libmp3lame"],
  ["webm", "libopus"],
  ["ogg", "libopus"],
]) {
  const output = fileURLToPath(new URL(`./tone.${extension}`, import.meta.url));
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=8000:duration=1",
      "-c:a",
      codec,
      output,
    ],
    { windowsHide: true, stdio: "inherit" },
  );
  if (result.status !== 0)
    throw result.error ?? new Error("Fixture generation failed");
}
