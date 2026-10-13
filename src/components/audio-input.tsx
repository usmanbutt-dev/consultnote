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
  compact = false,
}: {
  onAudioReady: (file: File, path?: string) => void;
  onReset: () => void;
  onBeforeReplace?: () => boolean;
  onBusyChange?: (busy: boolean) => void;
  cloud?: boolean;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [phase, setPhase] = useState<
    "idle" | "starting" | "recording" | "validating"
  >("idle");
  const [ready, setReady] = useState<ReadyAudio | null>(null);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const resources = useRef<Resources>({ operation: 0 });
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = phase !== "idle";
  const compactCapture = (ready || compact) && !busy;

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
    const current = resources.current;
    current.abort?.abort();
    const operation = ++current.operation;
    setError("");
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError(
        file.size === 0
          ? "The recording is empty. Try recording again."
          : "Choose audio smaller than 10 MiB.",
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
            "The recording reached 10 MiB. Record a shorter conversation.",
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
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h2
            id="capture-heading"
            className="text-[15px] font-semibold tracking-[-0.2px]"
          >
            Start with a conversation
          </h2>
          <p className="mt-1.5 text-xs text-slate-500">
            Record an appointment or bring an existing recording.
          </p>
        </div>
        <fieldset className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
          <legend className="sr-only">Audio input method</legend>
          {(["record", "upload"] as const).map((method) => (
            <button
              key={method}
              aria-pressed={mode === method}
              disabled={busy}
              onClick={() => {
                setMode(method);
                setError("");
              }}
              className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-[11px] font-semibold transition-colors disabled:opacity-50 ${mode === method ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {method === "record" ? (
                <Mic aria-hidden="true" size={14} />
              ) : (
                <UploadCloud aria-hidden="true" size={15} />
              )}
              {method === "record" ? "Record audio" : "Upload recording"}
            </button>
          ))}
        </fieldset>
      </div>
      <div
        className={`capture-surface m-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-teal-200/70 px-4 text-center sm:m-5 ${compactCapture ? "py-4" : "min-h-64 py-7"}`}
      >
        <span
          className={`microphone-ring mb-5 flex size-14 items-center justify-center rounded-full border border-teal-100 bg-white text-teal-700 ${compactCapture ? "hidden" : ""} ${phase === "recording" ? "recording-pulse" : ""}`}
        >
          {mode === "record" ? (
            <Mic aria-hidden="true" size={24} strokeWidth={1.7} />
          ) : (
            <FileAudio aria-hidden="true" size={24} strokeWidth={1.7} />
          )}
        </span>
        <h3 className="text-[15px] font-semibold">
          {phase === "recording"
            ? "Recording"
            : phase === "starting"
              ? "Opening microphone…"
              : phase === "validating"
                ? "Checking audio…"
                : ready
                  ? "Audio ready"
                  : candidate
                    ? "Audio awaiting check"
                    : mode === "record"
                      ? "Ready when you are"
                      : "Bring your recording"}
        </h3>
        {phase === "recording" ? (
          <div className="mt-3 w-40">
            <p
              aria-label="Recording duration"
              className="font-mono text-sm text-slate-600"
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
        ) : (
          <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">
            {phase === "validating"
              ? "Checking the format and recording length."
              : ready
                ? "Listen to your audio before continuing."
                : mode === "record"
                  ? "Capture both sides of the conversation from your microphone."
                  : "Choose audio to turn the discussion into a transcript and notes."}
          </p>
        )}
        <input
          ref={fileInput}
          id="audio-file"
          aria-label="Audio file"
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept=".mp3,.wav,.webm,.ogg,audio/mpeg,audio/wav,audio/webm,audio/ogg"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file && (!onBeforeReplace || onBeforeReplace()))
              void validate(file);
          }}
        />
        {phase === "recording" ? (
          <button
            onClick={stopRecording}
            className="mt-5 flex min-h-11 items-center gap-2 rounded-lg bg-red-700 px-5 text-xs font-semibold text-white"
          >
            <Square aria-hidden="true" size={14} /> Stop recording
          </button>
        ) : (
          <button
            disabled={busy || (mode === "record" && unsupported)}
            onClick={() => {
              if (mode === "record") void startRecording();
              else fileInput.current?.click();
            }}
            className="mt-5 flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {mode === "record" ? (
              <Mic aria-hidden="true" size={15} />
            ) : (
              <UploadCloud aria-hidden="true" size={16} />
            )}
            {mode === "record" ? "Start recording" : "Choose audio file"}
          </button>
        )}
        {busy && (
          <button
            onClick={cancel}
            className="mt-2 min-h-11 px-4 text-xs font-semibold text-slate-600"
          >
            Cancel
          </button>
        )}
        <p className="mt-3 text-[10px] leading-5 text-slate-500">
          MP3, WAV, WebM or OGG · Up to 10 MiB · 10 minutes
        </p>
      </div>
      {(error || (unsupported && mode === "record")) && (
        <p
          role="alert"
          className="mx-5 mb-4 rounded-lg bg-red-50 px-4 py-3 text-xs leading-6 text-red-800"
        >
          {error ||
            "Microphone recording is unavailable in this browser. Upload a recording instead."}
        </p>
      )}
      {candidate && !busy && (
        <div className="mx-5 mb-4 flex flex-col items-start justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="min-w-0 flex-1 break-all text-xs leading-6 text-slate-600">
            {candidate.name} is kept in this tab. Retry the check or choose
            another file.
          </p>
          <button
            onClick={() => {
              if (!onBeforeReplace || onBeforeReplace())
                void validate(candidate);
            }}
            className="min-h-11 shrink-0 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white"
          >
            Retry audio check
          </button>
          <button
            onClick={cancel}
            className="min-h-11 shrink-0 px-3 text-xs font-semibold text-slate-600"
          >
            Discard pending audio
          </button>
        </div>
      )}
      {ready && (
        <div className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <FileAudio
              aria-hidden="true"
              className="shrink-0 text-teal-700"
              size={18}
            />
            <p
              className="min-w-0 flex-1 truncate text-xs font-semibold"
              title={ready.file.name}
            >
              {ready.file.name}
            </p>
            <span className="text-xs text-slate-500">
              {formatTime(ready.durationSeconds)}
            </span>
            <button
              onClick={reset}
              aria-label="Remove audio"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <audio
            key={ready.url}
            aria-label="Audio playback"
            controls
            src={ready.url}
            className="mt-3 w-full"
          />
        </div>
      )}
      <p
        id="preview-notice"
        className="px-5 pb-5 text-center text-[11px] leading-5 text-slate-500"
      >
        Saving a consultation stores reviewed text, not the recording.
      </p>
    </section>
  );
}
