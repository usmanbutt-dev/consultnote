import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { ApiError, readBoundedBody } from "./http";
import ffprobe from "ffprobe-static";

export type ValidatedAudio = {
  bytes: Uint8Array;
  mimeType: string;
  durationSeconds: number;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 11 * 1024 * 1024;
const supportedTypes: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  webm: "audio/webm",
  ogg: "audio/ogg",
  opus: "audio/ogg",
};

type ProbeResult = {
  streams?: { codec_type?: string; duration?: string }[];
  format?: { duration?: string };
  packets?: { pts_time?: string; duration_time?: string }[];
};

function probe(
  file: string,
  entries: string,
  packets = false,
): Promise<ProbeResult> {
  const args = ["-v", "error", "-of", "json"];
  if (packets) args.push("-select_streams", "a");
  args.push("-show_entries", entries, file);
  return new Promise((resolve, reject) => {
    execFile(
      ffprobe.path,
      args,
      {
        timeout: 15_000,
        maxBuffer: 16 * 1024 * 1024,
        encoding: "utf8",
        windowsHide: true,
        shell: false,
      },
      (error, stdout) => {
        if (error) {
          reject(
            error.code === "ENOENT"
              ? new ApiError(
                  "INTERNAL_ERROR",
                  "Audio inspection is unavailable. Install FFmpeg and restart the app.",
                  500,
                )
              : new ApiError(
                  "INVALID_INPUT",
                  "This audio could not be inspected. Try a shorter recording or another file.",
                  400,
                ),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(
            new ApiError(
              "INVALID_INPUT",
              "This audio could not be read. Choose another recording.",
              400,
            ),
          );
        }
      },
    );
  });
}

async function inspectDuration(file: string): Promise<number> {
  const info = await probe(file, "stream=codec_type,duration:format=duration");
  const audioStreams = info.streams?.filter(
    (stream) => stream.codec_type === "audio",
  );
  if (!audioStreams?.length) {
    throw new ApiError(
      "UNSUPPORTED_AUDIO",
      "The file has no readable audio track.",
      415,
    );
  }
  let duration = Math.max(
    0,
    ...[info.format?.duration, ...audioStreams.map((stream) => stream.duration)]
      .map(Number)
      .filter(Number.isFinite),
  );
  // MediaRecorder WebM often omits duration in both the stream and container.
  if (duration <= 0) {
    const timing = await probe(file, "packet=pts_time,duration_time", true);
    for (const packet of timing.packets ?? []) {
      const start = Number(packet.pts_time);
      const length = Number(packet.duration_time);
      if (Number.isFinite(start) && Number.isFinite(length) && length > 0) {
        duration = Math.max(duration, start + length);
      }
    }
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new ApiError(
      "INVALID_INPUT",
      "The recording duration could not be determined. Choose another file.",
      400,
    );
  }
  if (duration > 600) {
    throw new ApiError(
      "INVALID_INPUT",
      "Choose a recording no longer than 10 minutes.",
      400,
    );
  }
  return duration;
}

export async function readAudioRequest(
  request: Request,
): Promise<ValidatedAudio> {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.split(";", 1)[0].trim().toLowerCase() !== "multipart/form-data"
  ) {
    throw new ApiError(
      "INVALID_INPUT",
      "Send one audio file as multipart form data.",
      400,
    );
  }
  const body = await readBoundedBody(request, MAX_REQUEST_BYTES);
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new ApiError(
      "INVALID_INPUT",
      "The upload could not be read. Choose the file again.",
      400,
    );
  }
  const files = form.getAll("audio");
  const file = files[0];
  if (files.length !== 1 || !(file instanceof File) || file.size === 0) {
    throw new ApiError("INVALID_INPUT", "Choose one nonempty audio file.", 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ApiError(
      "AUDIO_TOO_LARGE",
      "Choose audio smaller than 10 MiB.",
      413,
    );
  }
  return validateAudioBytes(new Uint8Array(await file.arrayBuffer()));
}

export async function validateAudioBytes(
  bytes: Uint8Array,
): Promise<ValidatedAudio> {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES)
    throw new ApiError(
      "AUDIO_TOO_LARGE",
      "Choose nonempty audio smaller than 10 MiB.",
      413,
    );
  let mimeType: string | undefined;
  try {
    // Bound signature inspection too; ffprobe verifies the actual file afterward.
    const detected = await fileTypeFromBuffer(bytes.subarray(0, 64 * 1024));
    mimeType = detected && supportedTypes[detected.ext];
  } catch {
    /* Malformed signatures are unsupported audio. */
  }
  if (!mimeType) {
    throw new ApiError(
      "UNSUPPORTED_AUDIO",
      "Choose an MP3, WAV, WebM or OGG audio file.",
      415,
    );
  }
  const directory = await mkdtemp(join(tmpdir(), "consultnote-audio-"));
  try {
    const path = join(directory, "recording");
    await writeFile(path, bytes);
    const durationSeconds = await inspectDuration(path);
    return { bytes, mimeType, durationSeconds };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
