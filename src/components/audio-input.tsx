"use client";

import { useEffect, useRef, useState } from "react";
import { FileAudio, Mic, Square, UploadCloud, X } from "lucide-react";
import { uploadCloudAudio, removeCloudAudio } from "@/lib/cloud-client";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SECONDS = 600;
// Leave a second for timer delay and the final encoded audio packet.
const RECORDING_STOP_SECONDS = MAX_SECONDS - 1;
type ReadyAudio = {
  file: File;
  url: string;
  durationSeconds: number;
  path?: string;
};
type Resources = {
  operation: number;
  abort?: AbortController;
  recorder?: MediaRecorder;
  stream?: MediaStream;
  timer?: ReturnType<typeof setInterval>;
  context?: AudioContext;
  frame?: number;
  url?: string;
};

function releaseRecording(resources: Resources) {
  if (resources.recorder) {
    resources.recorder.ondataavailable = null;
    resources.recorder.onstop = null;
    resources.recorder.onerror = null;
    if (resources.recorder.state !== "inactive") resources.recorder.stop();
    resources.recorder = undefined;
  }
  resources.stream?.getTracks().forEach((track) => track.stop());
  resources.stream = undefined;
  clearInterval(resources.timer);
  if (resources.frame !== undefined) cancelAnimationFrame(resources.frame);
  void resources.context?.close().catch(() => {});
  resources.context = undefined;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function AudioInput({
  onAudioReady,
  onReset,
  onBeforeReplace,
  onBusyChange,
  cloud = false,
  disabled = false,
}: {
  onAudioReady: (file: File, path?: string) => void;
  onReset: () => void;
  onBeforeReplace?: () => boolean;
  onBusyChange?: (busy: boolean) => void;
  cloud?: boolean;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<
    "idle" | "starting" | "recording" | "validating"
  >("idle");
  const [ready, setReady] = useState<ReadyAudio | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const resources = useRef<Resources>({ operation: 0 });
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = phase !== "idle";

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    const current = resources.current;
    return () => {
      current.operation++;
      current.abort?.abort();
      releaseRecording(current);
      if (current.url) URL.revokeObjectURL(current.url);
    };
  }, []);

  function cancel() {
    const current = resources.current;
    current.operation++;
    current.abort?.abort();
    releaseRecording(current);
    setCandidate(null);
    setPhase("idle");
    setError("");
    setLevel(0);
    setElapsed(0);
  }

  function reset() {
    if (onBeforeReplace && !onBeforeReplace()) return;
    cancel();
    const current = resources.current;
    if (current.url) URL.revokeObjectURL(current.url);
    current.url = undefined;
    setReady(null);
    if (ready?.path) void removeCloudAudio(ready.path).catch(() => {});
    if (fileInput.current) fileInput.current.value = "";
    onReset();
  }

  async function validate(file: File) {
    setReplacing(false);
    const current = resources.current;
    current.abort?.abort();
    const operation = ++current.operation;
    setError("");
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError(
        file.size === 0
          ? "The recording is empty. Try recording again."
          : "Choose a smaller recording (up to about 10 MB).",
      );
      setPhase("idle");
      return;
    }
    setCandidate(file);
    setPhase("validating");
    const abort = new AbortController();
    current.abort = abort;
    const form = new FormData();
    form.append("audio", file);
    try {
      const response = cloud
        ? null
        : await fetch("/api/audio/validate", {
            method: "POST",
            body: form,
            signal: abort.signal,
          });
      const result = cloud
        ? await uploadCloudAudio(file, abort.signal)
        : await response!.json();
      if (response && !response.ok)
        throw new Error(
          result.error?.message ??
            "Audio validation failed. Try another recording.",
        );
      if (operation !== current.operation) {
        if (result.path) void removeCloudAudio(result.path).catch(() => {});
        return;
      }
      const normalized = new File([file], file.name, { type: result.mimeType });
      const url = URL.createObjectURL(normalized);
      if (current.url) URL.revokeObjectURL(current.url);
      current.url = url;
      setReady({
        file: normalized,
        url,
        durationSeconds: result.durationSeconds,
        path: result.path,
      });
      setCandidate(null);
      if (ready?.path) void removeCloudAudio(ready.path).catch(() => {});
      onAudioReady(normalized, result.path);
    } catch (failure) {
      if (operation !== current.operation || abort.signal.aborted) return;
      setError(
        failure instanceof Error && failure.message !== "Failed to fetch"
          ? failure.message
          : "Could not check the recording. Check that the app is running, then choose the file again.",
      );
    } finally {
      if (operation === current.operation) setPhase("idle");
    }
  }

  function stopRecording() {
    const current = resources.current;
    if (current.recorder?.state === "recording") {
      setPhase("validating");
      current.recorder.stop();
      current.stream?.getTracks().forEach((track) => track.stop());
      clearInterval(current.timer);
    }
  }

  async function startRecording() {
    if (busy) return;
    const mimeType =
      typeof MediaRecorder !== "undefined"
        ? ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"].find((type) =>
            MediaRecorder.isTypeSupported(type),
          )
        : undefined;
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
      setUnsupported(true);
      setError(
        "Microphone recording is unavailable in this browser. Upload a recording instead.",
      );
      return;
    }
    if (onBeforeReplace && !onBeforeReplace()) return;
    setReplacing(false);
    const current = resources.current;
    const operation = ++current.operation;
    setPhase("starting");
    setError("");
    setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (operation !== current.operation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      current.stream = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      current.recorder = recorder;
      const chunks: Blob[] = [];
      let size = 0;
      let tooLarge = false;
      recorder.ondataavailable = ({ data }) => {
        size += data.size;
        if (size > MAX_BYTES) {
          tooLarge = true;
          stopRecording();
        } else if (!tooLarge && data.size) chunks.push(data);
      };
      recorder.onerror = () => {
        releaseRecording(current);
        setPhase("idle");
        setError(
          "Recording failed. Check your microphone or upload an audio file.",
        );
      };
      recorder.onstop = () => {
        if (operation !== current.operation) return;
        releaseRecording(current);
        setLevel(0);
        if (tooLarge) {
          setPhase("idle");
          setError(
            "The recording is too large. Record a shorter conversation.",
          );
          return;
        }
        const extension = mimeType.startsWith("audio/webm") ? "webm" : "ogg";
        void validate(
          new File(chunks, `recording.${extension}`, { type: mimeType }),
        );
      };
      recorder.start(250);
      setPhase("recording");
      const startedAt = performance.now();
      current.timer = setInterval(() => {
        const seconds = (performance.now() - startedAt) / 1000;
        setElapsed(Math.min(Math.floor(seconds), MAX_SECONDS));
        if (seconds >= RECORDING_STOP_SECONDS) stopRecording();
      }, 200);
      try {
        const context = new AudioContext();
        current.context = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const meter = () => {
          analyser.getByteTimeDomainData(samples);
          const peak =
            Math.max(...samples.map((sample) => Math.abs(sample - 128))) / 128;
          setLevel(Math.min(1, peak * 3));
          current.frame = requestAnimationFrame(meter);
        };
        meter();
      } catch {
        /* Recording still works if the optional level meter is unavailable. */
      }
    } catch (failure) {
      if (operation !== current.operation) return;
      releaseRecording(current);
      setPhase("idle");
      setError(
        failure instanceof DOMException && failure.name === "NotAllowedError"
          ? "Allow microphone access in your browser, or upload a recording."
          : "Could not open your microphone. Check that it is connected, or upload a recording.",
      );
    }
  }

  return (
    <section
      aria-labelledby="capture-heading"
      className="soft-panel overflow-hidden"
    >
      <input
        ref={fileInput}
        id="audio-file"
        aria-label="Audio file"
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept=".mp3,.wav,.webm,.ogg,audio/mpeg,audio/wav,audio/webm,audio/ogg"
        disabled={busy || disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file && (!onBeforeReplace || onBeforeReplace()))
            void validate(file);
        }}
      />
      <h2 id="capture-heading" className="sr-only">
        Audio recording
      </h2>
      {busy ? (
        <div className="animate-enter flex flex-col items-center gap-4 px-5 py-8 text-center">
          <Mic
            aria-hidden="true"
            size={28}
            className={
              phase === "recording"
                ? "recording-pulse text-teal-700"
                : "text-slate-600"
            }
          />
          <h3 className="text-lg font-semibold">
            {phase === "recording"
              ? "Recording"
              : phase === "starting"
                ? "Opening microphone…"
                : "Checking audio…"}
          </h3>
          {phase === "recording" && (
            <div className="w-44">
              <p
                aria-label="Recording duration"
                className="font-mono text-base"
              >
                {formatTime(elapsed)} / 10:00
              </p>
              <meter
                aria-label="Microphone input level"
                min={0}
                max={1}
                value={level}
                className="mt-3 h-3 w-full"
              />
            </div>
          )}
          {phase === "recording" && (
            <button
              onClick={stopRecording}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-red-700 px-5 font-semibold text-white"
            >
              <Square aria-hidden="true" size={15} /> Stop recording
            </button>
          )}
          <button
            onClick={cancel}
            className="min-h-11 rounded-lg border border-slate-300 px-5 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      ) : (
        !ready && (
          <div className="px-5 py-8 sm:px-8">
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                disabled={disabled || unsupported}
                onClick={() => void startRecording()}
                className="flex min-h-14 items-center justify-center gap-3 rounded-lg bg-teal-700 px-8 font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Mic aria-hidden="true" size={23} /> Start recording
              </button>
              <button
                disabled={disabled}
                onClick={() => fileInput.current?.click()}
                className="flex min-h-14 items-center justify-center gap-3 rounded-lg border border-slate-300 px-8 font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                <UploadCloud aria-hidden="true" size={23} /> Upload recording
              </button>
            </div>
            <p className="mt-5 text-center text-sm leading-6 text-slate-700">
              MP3, WAV, WebM or OGG · Up to 10 minutes
            </p>
          </div>
        )
      )}
      {error && (
        <p
          role="alert"
          className="mx-5 my-4 rounded-lg bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      )}
      {candidate && !busy && (
        <div className="mx-5 mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
          <p className="min-w-0 flex-1 break-words text-sm leading-6">
            {candidate.name} is kept in this tab. Retry or choose another file.
          </p>
          <button
            onClick={() => {
              if (!onBeforeReplace || onBeforeReplace())
                void validate(candidate);
            }}
            disabled={disabled}
            className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Retry audio check
          </button>
          <button
            onClick={cancel}
            className="min-h-11 px-3 text-sm font-semibold"
          >
            Discard recording
          </button>
        </div>
      )}
      {ready && (
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <FileAudio
              aria-hidden="true"
              size={22}
              className="shrink-0 text-slate-600"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Audio ready</p>
              <p
                className="mt-1 truncate text-sm text-slate-700"
                title={ready.file.name}
              >
                {ready.file.name}
              </p>
            </div>
            <span className="text-sm text-slate-700">
              {formatTime(ready.durationSeconds)}
            </span>
            <button
              disabled={busy || disabled}
              onClick={() => setReplacing(!replacing)}
              aria-label="Replace audio"
              className="min-h-11 px-2 text-sm font-medium underline decoration-slate-300 underline-offset-4 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              disabled={disabled}
              onClick={reset}
              aria-label="Remove audio"
              className="flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          {replacing && !busy && (
            <div className="mt-3 flex flex-wrap gap-3 rounded-lg border border-slate-200 p-3">
              <button
                disabled={disabled || unsupported}
                onClick={() => void startRecording()}
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
              >
                Start recording
              </button>
              <button
                disabled={disabled}
                onClick={() => fileInput.current?.click()}
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
              >
                Choose audio file
              </button>
            </div>
          )}
          <audio
            key={ready.url}
            aria-label="Audio playback"
            controls
            src={ready.url}
            className="mt-4 w-full"
          />
        </div>
      )}
    </section>
  );
}
