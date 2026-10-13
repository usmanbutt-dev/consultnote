import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAudioRequest } from "@/lib/audio";
import { audioRequest, silentWav } from "../fixtures/wav";
import metadata from "../fixtures/probe/metadata.json";
import webm from "../fixtures/probe/webm.json";
import packets from "../fixtures/probe/packets.json";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
const probe = vi.mocked(execFile);
const temporaryFiles: string[] = [];
type ProbeCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

function result(output: unknown) {
  probe.mockImplementationOnce(((
    _command: string,
    args: readonly string[],
    _options: unknown,
    callback: ProbeCallback,
  ) => {
    temporaryFiles.push(args[args.length - 1]);
    callback(null, JSON.stringify(output), "");
  }) as unknown as typeof execFile);
}

beforeEach(() => {
  probe.mockReset();
  temporaryFiles.length = 0;
});
afterEach(async () => {
  for (const file of temporaryFiles)
    await expect(access(file)).rejects.toThrow();
});

describe("audio upload validation", () => {
  it("uses the actual bytes and returns normalized audio metadata", async () => {
    result(metadata);
    const audio = await readAudioRequest(
      audioRequest(silentWav(), "audio/x-wav"),
    );
    expect(audio).toEqual({
      bytes: silentWav(),
      mimeType: "audio/wav",
      durationSeconds: 1,
    });
    expect(probe).toHaveBeenCalledWith(
      "ffprobe",
      expect.any(Array),
      expect.objectContaining({
        timeout: 15000,
        windowsHide: true,
        shell: false,
      }),
      expect.any(Function),
    );
  });

  it("rejects a file above 10 MiB before probing", async () => {
    await expect(
      readAudioRequest(audioRequest(new Uint8Array(10 * 1024 * 1024 + 1))),
    ).rejects.toMatchObject({ code: "AUDIO_TOO_LARGE", status: 413 });
    expect(probe).not.toHaveBeenCalled();
  });

  it("requires exactly one nonempty file", async () => {
    const body = new FormData();
    body.append("audio", "not a file");
    await expect(
      readAudioRequest(
        new Request("http://localhost", { method: "POST", body }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 });
    await expect(
      readAudioRequest(audioRequest(new Uint8Array())),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    body.set("audio", new File([silentWav() as BlobPart], "one.wav"));
    body.append("audio", new File([silentWav() as BlobPart], "two.wav"));
    await expect(
      readAudioRequest(
        new Request("http://localhost", { method: "POST", body }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a text file claiming to be WAV", async () => {
    await expect(
      readAudioRequest(audioRequest(new TextEncoder().encode("not audio"))),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_AUDIO", status: 415 });
    expect(probe).not.toHaveBeenCalled();
  });

  it("rejects malformed multipart and non-multipart requests", async () => {
    for (const contentType of [
      "application/json",
      "multipart/form-data; boundary=broken",
    ]) {
      await expect(
        readAudioRequest(
          new Request("http://localhost", {
            method: "POST",
            headers: { "content-type": contentType },
            body: "broken",
          }),
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 });
    }
  });

  it("rejects a container without an audio stream", async () => {
    result({ streams: [{ codec_type: "video" }], format: { duration: "1" } });
    await expect(readAudioRequest(audioRequest())).rejects.toMatchObject({
      code: "UNSUPPORTED_AUDIO",
    });
  });

  it.each([0, -1, "N/A", "NaN"])(
    "rejects unreadable duration %s",
    async (duration) => {
      result({ streams: [{ codec_type: "audio" }], format: { duration } });
      result({ packets: [] });
      await expect(readAudioRequest(audioRequest())).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    },
  );

  it.each([600, 601])("enforces the %s-second boundary", async (duration) => {
    result({
      streams: [{ codec_type: "audio" }],
      format: { duration: String(duration) },
    });
    if (duration === 600)
      expect((await readAudioRequest(audioRequest())).durationSeconds).toBe(
        600,
      );
    else
      await expect(readAudioRequest(audioRequest())).rejects.toMatchObject({
        code: "INVALID_INPUT",
        status: 400,
      });
  });

  it("uses final audio packet timing for browser WebM with no container duration", async () => {
    result(webm);
    result(packets);
    const bytes = await readFile(
      new URL("../fixtures/audio/tone.webm", import.meta.url),
    );
    const audio = await readAudioRequest(
      audioRequest(bytes, "audio/webm;codecs=opus"),
    );
    expect(audio.mimeType).toBe("audio/webm");
    expect(audio.durationSeconds).toBeCloseTo(1.013);
    expect(probe.mock.calls[1][1]).toEqual(
      expect.arrayContaining([
        "-select_streams",
        "a",
        "-show_entries",
        "packet=pts_time,duration_time",
      ]),
    );
  });

  it.each(["unreadable", "timeout", "missing executable", "invalid JSON"])(
    "cleans temporary audio after %s",
    async (failure) => {
      probe.mockImplementationOnce(((
        _command: string,
        args: readonly string[],
        _options: unknown,
        callback: ProbeCallback,
      ) => {
        temporaryFiles.push(args[args.length - 1]);
        if (failure === "invalid JSON") callback(null, "not JSON", "");
        else
          callback(
            Object.assign(new Error("private path and audio"), {
              code: failure === "missing executable" ? "ENOENT" : 1,
              killed: failure === "timeout",
            }),
            "",
            "",
          );
      }) as unknown as typeof execFile);
      await expect(readAudioRequest(audioRequest())).rejects.toMatchObject({
        code:
          failure === "missing executable" ? "INTERNAL_ERROR" : "INVALID_INPUT",
      });
    },
  );
});
