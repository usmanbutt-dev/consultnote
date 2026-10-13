"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  ChevronRight,
  FileText,
  HelpCircle,
  Laptop,
  MessageSquareText,
  Plus,
  Save,
  ShieldCheck,
} from "lucide-react";
import { AudioInput } from "./audio-input";
import { TranscriptReview } from "./transcript-review";
import { NotesEditor } from "./notes-editor";
import { ConsultationHistory } from "./consultation-history";
import { z } from "zod";
import {
  transcriptSchema,
  notesResultSchema,
  consultationInputSchema,
  consultationRecordSchema,
  consultationSummarySchema,
  type SpeakerAssignment,
  type Transcript,
  type NotesResult,
  type ConsultationRecord,
  type ConsultationInput,
} from "@/lib/consultation";
import type { TranscriptionResult } from "@/lib/gemini";
import { toMarkdown } from "@/lib/markdown";
import { NOTES_PROMPT_VERSION } from "@/lib/prompts";
import { type AudioLanguage, type NotesLanguage } from "@/lib/languages";
import { removeCloudAudio, uploadCloudAudio } from "@/lib/cloud-client";
import { suggestedConsultationTitle } from "@/lib/consultation-title";

async function apiRequest(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(
      "The connection to the app was interrupted. Keep this tab open and retry when the app is reachable.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The app response was interrupted or could not be read. Your draft is still available.",
    );
  }
  if (!response.ok) {
    const parsed = z
      .object({
        error: z.object({ message: z.string(), code: z.string().optional() }),
      })
      .safeParse(data);
    throw Object.assign(
      new Error(
        parsed.success
          ? parsed.data.error.message
          : "The request failed. Please retry.",
      ),
      { applicationFailure: parsed.success && Boolean(parsed.data.error.code) },
    );
  }
  return data;
}

export function ConsultationWorkspace({
  configuration,
}: {
  configuration: {
    provider: string;
    transcriptionConfigured: boolean;
    notesConfigured: boolean;
    notesModel: string;
    cloud?: boolean;
  };
}) {
  const [audio, setAudio] = useState<File | null>(null);
  const [audioPath, setAudioPath] = useState<string | undefined>();
  const cloudJob = useRef<{
    id: string;
    path: string;
    language: AudioLanguage;
    submission?: Promise<unknown>;
  } | null>(null);
  const audioLanguage: AudioLanguage = "auto";
  const notesLanguage: NotesLanguage = "en";
  const [inputVersion, setInputVersion] = useState(0);
  const [panel, setPanel] = useState<"transcript" | "notes">("transcript");
  const [audioBusy, setAudioBusy] = useState(false);
  const [transcription, setTranscription] =
    useState<TranscriptionResult | null>(null);
  const [assignments, setAssignments] = useState<SpeakerAssignment[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState("");
  const [title, setTitle] = useState("Untitled consultation");
  const titleEdited = useRef(false);
  const sessionDate = useRef(new Date());
  const [notesResult, setNotesResult] = useState<NotesResult | null>(null);
  const [notesProvenance, setNotesProvenance] = useState<Pick<
    ConsultationInput,
    "model" | "promptVersion"
  > | null>(null);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [savedRecord, setSavedRecord] = useState<ConsultationRecord | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<
    z.infer<typeof consultationSummarySchema>[]
  >([]);
  const notesRequest = useRef<{
    generation: number;
    controller?: AbortController;
  }>({ generation: 0 });
  const navigation = useRef(0);
  const busy = transcribing || generatingNotes || saving || audioBusy;
  const sample = Boolean(transcription?.promptVersion.startsWith("sample-v1"));

  useEffect(() => {
    let active = true;
    const activeNotes = notesRequest.current;
    void apiRequest("/api/consultations")
      .then((data) => {
        const parsed = z
          .object({ consultations: z.array(consultationSummarySchema) })
          .safeParse(data);
        if (active && parsed.success) setHistory(parsed.data.consultations);
      })
      .catch(() => {
        if (active)
          setStorageError(
            "Consultation history could not be loaded. Your current draft is still available.",
          );
      });
    return () => {
      active = false;
      activeNotes.controller?.abort();
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const request = useRef<{
    generation: number;
    busy: boolean;
    controller?: AbortController;
  }>({ generation: 0, busy: false });

  useEffect(() => {
    const active = request.current;
    return () => {
      active.generation++;
      active.controller?.abort();
    };
  }, []);

  function cancelTranscription() {
    request.current.generation++;
    request.current.controller?.abort();
    request.current.busy = false;
    setTranscribing(false);
    setTranscriptionError("");
  }

  function cancelNotes() {
    notesRequest.current.generation++;
    notesRequest.current.controller?.abort();
    setGeneratingNotes(false);
    setNotesError("");
  }

  function discardCloudJob() {
    const previousJob = cloudJob.current;
    cloudJob.current = null;
    if (previousJob)
      void Promise.resolve(previousJob.submission)
        .catch(() => {})
        .then(() =>
          fetch(`/api/transcribe/jobs/${previousJob.id}`, { method: "DELETE" }),
        )
        .catch(() => {});
  }

  function beforeReplace() {
    if (saving) return false;
    if (
      transcription &&
      dirty &&
      !window.confirm(
        "Replace this consultation? Your transcript and role edits will be discarded.",
      )
    )
      return false;
    cancelTranscription();
    cancelNotes();
    navigation.current++;
    return true;
  }

  function clearTranscript() {
    titleEdited.current = false;
    sessionDate.current = new Date();
    setTranscription(null);
    setAssignments([]);
    setNotesResult(null);
    setNotesProvenance(null);
    setSavedRecord(null);
    setDirty(false);
    setStorageError("");
    setTitle("Untitled consultation");
  }

  function acceptAudio(file: File, path?: string) {
    cancelTranscription();
    discardCloudJob();
    setAudio(file);
    setAudioPath(path);
    clearTranscript();
  }

  async function transcribe() {
    const active = request.current;
    if (!audio || active.busy || audioBusy) return;
    if (
      transcription &&
      !window.confirm(
        "Transcribe again? A successful result will replace your transcript and role edits.",
      )
    )
      return;
    const generation = ++active.generation;
    active.controller = new AbortController();
    active.busy = true;
    setTranscribing(true);
    setTranscriptionError("");
    setPanel("transcript");
    const body = new FormData();
    body.append("audio", audio);
    try {
      const data = configuration.cloud
        ? await transcribeCloud(audio, active.controller.signal)
        : await apiRequest("/api/transcribe", {
            method: "POST",
            headers: { "x-audio-language": audioLanguage },
            body,
            signal: active.controller.signal,
          });
      if (generation !== active.generation) return;
      const parsed = z
        .object({
          transcript: transcriptSchema,
          model: z.string(),
          promptVersion: z.string(),
        })
        .safeParse(data);
      if (!parsed.success) {
        throw new Error("The transcript could not be read. Please retry.");
      }
      setTranscription({
        transcript: parsed.data.transcript,
        model: parsed.data.model,
        promptVersion: parsed.data.promptVersion,
      });
      const nextAssignments = parsed.data.transcript.speakers.map(
        (speaker) => ({
          speakerId: speaker.id,
          role: speaker.suggestedRole,
        }),
      );
      updateAutomaticTitle(parsed.data.transcript, nextAssignments);
      setAssignments(nextAssignments);
      cancelNotes();
      setNotesResult(null);
      setNotesProvenance(null);
      setSavedRecord(null);
      setDirty(true);
    } catch (error) {
      if (generation !== active.generation) return;
      setTranscriptionError(
        error instanceof Error && error.message !== "Failed to fetch"
          ? error.message
          : "Could not reach the app. Check your connection and retry.",
      );
    } finally {
      if (generation === active.generation) {
        active.busy = false;
        setTranscribing(false);
      }
    }
  }

  async function transcribeCloud(
    file: File,
    signal: AbortSignal,
  ): Promise<unknown> {
    let job = cloudJob.current;
    let path = audioPath;
    if (!job) {
      if (!path) path = (await uploadCloudAudio(file, signal)).path;
      signal.throwIfAborted();
      setAudioPath(path);
      job = { id: crypto.randomUUID(), path, language: audioLanguage };
      cloudJob.current = job;
    }
    if (!job.submission) {
      job.submission = apiRequest("/api/transcribe/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: job.id, path, language: job.language }),
      });
      try {
        await job.submission;
      } catch (error) {
        if (cloudJob.current === job) {
          job.submission = undefined;
          if (
            error instanceof Error &&
            "applicationFailure" in error &&
            error.applicationFailure === true
          ) {
            cloudJob.current = null;
            setAudioPath(undefined);
            void removeCloudAudio(job.path).catch(() => {});
          }
        }
        throw error;
      }
    } else if (job.submission) await job.submission;
    while (true) {
      signal.throwIfAborted();
      const status = z
        .object({
          status: z.string(),
          result: z.unknown().optional(),
          failure: z.object({ message: z.string() }).nullable().optional(),
        })
        .parse(await apiRequest(`/api/transcribe/jobs/${job.id}`, { signal }));
      signal.throwIfAborted();
      if (status.status === "completed") {
        cloudJob.current = null;
        setAudioPath(undefined);
        return status.result;
      }
      if (["failed", "cancelled"].includes(status.status)) {
        cloudJob.current = null;
        setAudioPath(undefined);
        throw new Error(
          status.failure?.message ??
            "Transcription failed. Upload the recording again.",
        );
      }
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, 2000);
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", abort, { once: true });
      });
    }
  }

  function allowSourceEdit(): boolean {
    if (
      notesResult &&
      !window.confirm(
        "Changing the transcript or roles will discard the current notes. Continue?",
      )
    )
      return false;
    cancelNotes();
    setNotesResult(null);
    setNotesProvenance(null);
    setDirty(true);
    return true;
  }
  function updateAutomaticTitle(
    transcript: Transcript,
    roles: SpeakerAssignment[],
  ) {
    if (titleEdited.current) return;
    setTitle(
      suggestedConsultationTitle(
        {
          ...transcript,
          speakers: transcript.speakers.map((speaker) => ({
            ...speaker,
            suggestedRole:
              roles.find((item) => item.speakerId === speaker.id)?.role ??
              speaker.suggestedRole,
          })),
        },
        sessionDate.current,
      ),
    );
  }
  function editTranscript(transcript: Transcript): boolean {
    if (
      !transcription ||
      JSON.stringify(transcript) === JSON.stringify(transcription.transcript)
    )
      return true;
    if (!allowSourceEdit()) return false;
    setTranscription({ ...transcription, transcript });
    updateAutomaticTitle(transcript, assignments);
    return true;
  }
  function editAssignments(next: SpeakerAssignment[]) {
    if (JSON.stringify(next) === JSON.stringify(assignments)) return;
    if (allowSourceEdit()) {
      setAssignments(next);
      if (transcription) updateAutomaticTitle(transcription.transcript, next);
    }
  }
  async function createNotes() {
    if (!transcription || busy) return;
    if (
      notesResult &&
      !window.confirm(
        "Regenerate notes? A successful result will replace your note edits.",
      )
    )
      return;
    const generation = ++notesRequest.current.generation;
    const controller = new AbortController();
    notesRequest.current.controller = controller;
    setGeneratingNotes(true);
    setNotesError("");
    setPanel("notes");
    try {
      const data = await apiRequest("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: transcription.transcript,
          assignments,
          notesLanguage,
        }),
        signal: controller.signal,
      });
      if (generation !== notesRequest.current.generation) return;
      const parsed = notesResultSchema.safeParse(data);
      if (!parsed.success)
        throw new Error("The notes could not be read. Please retry.");
      const checked = consultationInputSchema.safeParse({
        title,
        transcript: transcription.transcript,
        assignments,
        notesResult: parsed.data,
        model: transcription.model,
        promptVersion: transcription.promptVersion,
      });
      if (!checked.success)
        throw new Error(
          "The notes contain invalid source references. Please retry.",
        );
      setNotesResult(parsed.data);
      setNotesProvenance({
        model: `${transcription.model} | notes:Groq:${configuration.notesModel}`,
        promptVersion: `${transcription.promptVersion} | notes:${NOTES_PROMPT_VERSION}/${notesLanguage}`,
      });
      setDirty(true);
    } catch (error) {
      if (generation === notesRequest.current.generation)
        setNotesError(
          error instanceof Error
            ? error.message
            : "Notes could not be generated. Please retry.",
        );
    } finally {
      if (generation === notesRequest.current.generation)
        setGeneratingNotes(false);
    }
  }
  async function refreshHistory() {
    const parsed = z
      .object({ consultations: z.array(consultationSummarySchema) })
      .parse(await apiRequest("/api/consultations"));
    setHistory(parsed.consultations);
  }
  async function save() {
    if (!transcription || !notesResult || busy) return;
    setSaving(true);
    setStorageError("");
    const input = {
      title,
      transcript: transcription.transcript,
      assignments,
      notesResult,
      model: notesProvenance?.model ?? transcription.model,
      promptVersion:
        notesProvenance?.promptVersion ?? transcription.promptVersion,
    };
    try {
      const parsed = consultationRecordSchema.parse(
        await apiRequest(
          savedRecord
            ? `/api/consultations/${savedRecord.id}`
            : "/api/consultations",
          {
            method: savedRecord ? "PATCH" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          },
        ),
      );
      setSavedRecord(parsed);
      setTitle(parsed.title);
      setDirty(false);
      await refreshHistory();
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Saving failed. Your draft is retained.",
      );
    } finally {
      setSaving(false);
    }
  }
  function loadDraft(
    input: ConsultationInput,
    record: ConsultationRecord | null,
  ) {
    discardCloudJob();
    setAudio(null);
    setAudioPath(undefined);
    setInputVersion((v) => v + 1);
    setAudioBusy(false);
    setTranscription({
      transcript: input.transcript,
      model: input.model.split(" | notes:")[0],
      promptVersion: input.promptVersion.split(" | notes:")[0],
    });
    setAssignments(input.assignments);
    setNotesResult(input.notesResult);
    setNotesProvenance({
      model: input.model,
      promptVersion: input.promptVersion,
    });
    setTitle(input.title);
    titleEdited.current = true;
    setSavedRecord(record);
    setDirty(!record);
    setPanel("notes");
    setStorageError("");
  }
  async function openConsultation(id: string) {
    if (busy || !beforeReplace()) return;
    const generation = navigation.current;
    setSaving(true);
    setStorageError("");
    try {
      const record = consultationRecordSchema.parse(
        await apiRequest(`/api/consultations/${id}`),
      );
      if (generation === navigation.current) loadDraft(record, record);
    } catch (error) {
      if (generation === navigation.current)
        setStorageError(
          error instanceof Error ? error.message : "Opening failed.",
        );
    } finally {
      if (generation === navigation.current) setSaving(false);
    }
  }
  async function loadSample() {
    if (busy || !beforeReplace()) return;
    const generation = navigation.current;
    setSaving(true);
    setStorageError("");
    try {
      const input = consultationInputSchema.parse(
        await apiRequest("/api/sample"),
      );
      if (generation === navigation.current) loadDraft(input, null);
    } catch (error) {
      if (generation === navigation.current)
        setStorageError(
          error instanceof Error
            ? error.message
            : "Sample could not be loaded.",
        );
    } finally {
      if (generation === navigation.current) setSaving(false);
    }
  }
  async function removeConsultation(id: string) {
    if (
      busy ||
      !window.confirm("Delete this saved consultation? This cannot be undone.")
    )
      return;
    setSaving(true);
    setStorageError("");
    try {
      const response = await fetch(`/api/consultations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error("The consultation could not be deleted. Please retry.");
      if (savedRecord?.id === id) {
        cancelTranscription();
        cancelNotes();
        clearTranscript();
        setAudio(null);
        setInputVersion((v) => v + 1);
      }
      await refreshHistory();
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Deletion failed.",
      );
    } finally {
      setSaving(false);
    }
  }
  function exportMarkdown() {
    if (!savedRecord || dirty) return;
    const blob = new Blob([toMarkdown(savedRecord)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      savedRecord.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "consultation"
    }.md`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function focusSource(id: string) {
    setPanel("transcript");
    requestAnimationFrame(() => {
      const element = document.getElementById(`text-${id}`);
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.focus();
    });
  }

  function newConsultation() {
    if (!beforeReplace()) return;
    discardCloudJob();
    setAudio(null);
    setAudioPath(undefined);
    setAudioBusy(false);
    clearTranscript();
    setInputVersion((version) => version + 1);
    setPanel("transcript");
  }

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#workspace"
        className="absolute -top-20 left-4 z-50 rounded-lg bg-white px-4 py-3 text-sm font-semibold shadow-lg focus:top-4"
      >
        Skip to workspace
      </a>

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white px-5 py-7 lg:flex">
        <a
          href="#workspace"
          aria-label="ConsultNote home"
          className="flex items-center gap-3 px-2"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-teal-700 text-white">
            <AudioLines aria-hidden="true" size={23} />
          </span>
          <span className="text-[21px] font-semibold tracking-[-0.7px]">
            Consult<span className="text-teal-700">Note</span>
          </span>
        </a>
        <p className="mt-9 px-3 text-[10px] font-semibold tracking-[1.8px] text-slate-500">
          YOUR WORKSPACE
        </p>
        <nav aria-label="Main navigation" className="mt-3">
          <a
            href="#workspace"
            aria-current="page"
            className="flex items-center gap-3 rounded-lg bg-teal-50 px-3 py-3 text-[13px] font-semibold text-teal-800"
          >
            <MessageSquareText aria-hidden="true" size={18} /> Consultations
          </a>
        </nav>
        <button
          onClick={newConsultation}
          disabled={saving}
          className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold transition-colors hover:border-teal-300 hover:bg-teal-50"
        >
          <Plus aria-hidden="true" size={17} /> New consultation
        </button>
        <div className="mt-9 px-1">
          <ConsultationHistory
            items={history}
            activeId={savedRecord?.id}
            busy={busy}
            onOpen={(id) => void openConsultation(id)}
            onDelete={(id) => void removeConsultation(id)}
          />
        </div>
        <details className="mt-6 px-2 text-xs text-slate-600">
          <summary className="flex min-h-11 items-center gap-2 font-medium">
            <HelpCircle aria-hidden="true" size={16} /> How it works
          </summary>
          <p className="pb-3 pl-6 leading-6">
            Capture audio, review the transcript and speakers, then create and
            save your notes.
          </p>
        </details>
        <div className="mt-auto flex items-center gap-3 border-t border-slate-100 px-2 pt-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
            <Laptop aria-hidden="true" size={17} className="text-slate-500" />
          </span>
          <div>
            <p className="text-xs font-semibold">Personal workspace</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {configuration.cloud ? "Cloud workspace" : "Local preview"}
            </p>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-18 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-5 sm:px-9">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <AudioLines
              aria-hidden="true"
              size={21}
              className="mr-1 text-teal-700 lg:hidden"
            />
            <span className="hidden sm:inline">Consultations</span>
            <ChevronRight
              aria-hidden="true"
              size={13}
              className="hidden sm:block"
            />
            <span className="font-medium text-slate-700">New consultation</span>
          </div>
          {configuration.cloud && (
            <button
              onClick={async () => {
                if (
                  dirty &&
                  !window.confirm(
                    "Sign out? Unsaved changes will be discarded.",
                  )
                )
                  return;
                try {
                  await apiRequest("/api/auth/signout", { method: "POST" });
                  setDirty(false);
                  window.location.assign("/login");
                } catch {
                  setStorageError("Sign-out failed. Please try again.");
                }
              }}
              disabled={busy}
              className="min-h-11 px-3 text-xs font-semibold text-slate-600"
            >
              Sign out
            </button>
          )}
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-900">
            Interview demo
          </span>
        </header>

        <main
          id="workspace"
          tabIndex={-1}
          className="mx-auto max-w-7xl px-5 py-7 sm:px-9 sm:py-9"
        >
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10px] font-semibold tracking-[1.8px] text-teal-700">
                CONSULTATION WORKSPACE
              </p>
              <h1 className="mt-2 text-[30px] font-semibold tracking-[-1.1px] sm:text-[34px]">
                New consultation
              </h1>
              <p className="mt-2 max-w-lg text-[13px] leading-6 text-slate-500">
                Turn a conversation into a clear, reviewable record.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void save()}
                disabled={
                  !transcription ||
                  !notesResult ||
                  !title.trim() ||
                  busy ||
                  !dirty
                }
                className="flex min-h-11 w-fit items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Save aria-hidden="true" size={16} />{" "}
                {saving ? "Saving…" : "Save consultation"}
              </button>
              <button
                onClick={exportMarkdown}
                disabled={!savedRecord || dirty || busy}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Export Markdown
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="consultation-title"
                className="mb-2 block text-xs font-semibold text-slate-600"
              >
                Consultation title
              </label>
              <input
                id="consultation-title"
                value={title}
                maxLength={120}
                disabled={busy}
                onChange={(event) => {
                  titleEdited.current = true;
                  setTitle(event.currentTarget.value);
                  setDirty(true);
                }}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 disabled:opacity-60"
              />
            </div>
            <button
              onClick={() => void loadSample()}
              disabled={busy}
              className="min-h-11 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-800 disabled:opacity-50"
            >
              Load sample consultation
            </button>
          </div>
          <p role="status" className="mt-2 text-[11px] text-slate-500">
            {savedRecord && !dirty
              ? "All changes saved."
              : dirty
                ? "Unsaved changes. Review the notes before saving."
                : "Record or upload audio, or explore the prepared sample."}
          </p>
          {storageError && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-6 text-red-800"
            >
              {storageError}
            </p>
          )}
          {sample && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <p className="font-semibold">Prepared fictional sample</p>
              <p className="mt-1 leading-6">
                This uses an example transcript; no new audio was transcribed.
              </p>
            </div>
          )}
          <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4 lg:hidden">
            <summary className="min-h-9 text-xs font-semibold text-slate-700">
              Saved consultations
            </summary>
            <ConsultationHistory
              items={history}
              activeId={savedRecord?.id}
              busy={busy}
              emptyLabel="No saved consultations"
              onOpen={(id) => void openConsultation(id)}
              onDelete={(id) => void removeConsultation(id)}
            />
            <button
              onClick={newConsultation}
              disabled={saving}
              className="mt-3 min-h-11 rounded-md border border-slate-200 px-3 text-xs font-semibold"
            >
              New consultation
            </button>
          </details>

          <ol
            aria-label="Consultation steps"
            className="my-7 flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/60 p-4 sm:gap-5"
          >
            {["Capture audio", "Review transcript", "Review notes", "Save"].map(
              (step, index) => (
                <li
                  key={step}
                  aria-current={
                    index ===
                    (savedRecord && !dirty
                      ? 3
                      : notesResult
                        ? 2
                        : transcription
                          ? 1
                          : 0)
                      ? "step"
                      : undefined
                  }
                  className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:text-left"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${index === (savedRecord && !dirty ? 3 : notesResult ? 2 : transcription ? 1 : 0) ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    0{index + 1}
                  </span>
                  <span
                    className={`text-[11px] sm:text-xs ${index === (savedRecord && !dirty ? 3 : notesResult ? 2 : transcription ? 1 : 0) ? "font-semibold text-teal-800" : "text-slate-500"}`}
                  >
                    {step}
                  </span>
                </li>
              ),
            )}
          </ol>

          <AudioInput
            cloud={configuration.cloud}
            compact={Boolean(transcription)}
            key={inputVersion}
            onAudioReady={acceptAudio}
            onReset={() => {
              discardCloudJob();
              setAudio(null);
              setAudioPath(undefined);
              clearTranscript();
            }}
            onBeforeReplace={beforeReplace}
            onBusyChange={setAudioBusy}
          />

          <div
            role="group"
            aria-label="Workspace panels"
            className="mt-6 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 xl:hidden"
          >
            <button
              aria-pressed={panel === "transcript"}
              onClick={() => setPanel("transcript")}
              className={`min-h-11 flex-1 rounded-md text-xs font-semibold ${panel === "transcript" ? "bg-teal-50 text-teal-800" : "text-slate-500"}`}
            >
              Transcript
            </button>
            <button
              aria-pressed={panel === "notes"}
              onClick={() => setPanel("notes")}
              className={`min-h-11 flex-1 rounded-md text-xs font-semibold ${panel === "notes" ? "bg-teal-50 text-teal-800" : "text-slate-500"}`}
            >
              Notes
            </button>
          </div>
          <div className="mt-4 grid items-start gap-5 xl:grid-cols-2">
            <section
              aria-labelledby="transcript-heading"
              className={`soft-panel animate-enter min-h-72 min-w-0 flex-col xl:flex ${panel === "transcript" ? "flex" : "hidden"}`}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <MessageSquareText
                  aria-hidden="true"
                  size={17}
                  className="text-slate-500"
                />
                <h2
                  id="transcript-heading"
                  className="text-[13px] font-semibold"
                >
                  Conversation transcript
                </h2>
                <span className="ml-auto text-[10px] text-slate-500">
                  {transcription
                    ? `${transcription.transcript.speakers.length} speakers`
                    : audio
                      ? "Audio captured"
                      : "Waiting for audio"}
                </span>
              </div>
              <div className="border-b border-slate-100 px-5 py-4">
                {!configuration.transcriptionConfigured && (
                  <p className="mb-3 text-xs leading-6 text-amber-900">
                    To transcribe, add{" "}
                    {configuration.provider === "assemblyai"
                      ? "ASSEMBLYAI_API_KEY"
                      : "GEMINI_API_KEY"}{" "}
                    to .env.local and restart the app. Your key stays on the
                    server.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void transcribe()}
                    disabled={!audio || busy}
                    className="min-h-11 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {transcribing
                      ? "Transcribing…"
                      : transcription
                        ? "Transcribe again"
                        : "Transcribe audio"}
                  </button>
                  {transcribing && (
                    <button
                      onClick={cancelTranscription}
                      className="min-h-11 px-3 text-xs font-semibold text-slate-600"
                    >
                      Cancel transcription
                    </button>
                  )}
                  <p
                    role="status"
                    aria-live="polite"
                    className="text-[11px] text-slate-500"
                  >
                    {transcribing
                      ? "Transcribing your audio…"
                      : transcription
                        ? "Transcript ready for review."
                        : "Your recording is processed online into English."}
                  </p>
                </div>
                {transcriptionError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-6 text-red-800"
                  >
                    {transcriptionError}
                  </p>
                )}
              </div>
              {transcription ? (
                <TranscriptReview
                  transcript={transcription.transcript}
                  assignments={assignments}
                  disabled={busy}
                  onTranscriptChange={editTranscript}
                  onAssignmentsChange={editAssignments}
                  onPendingEdit={() => setDirty(true)}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-9 text-center">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-slate-50">
                    <AudioLines
                      aria-hidden="true"
                      size={23}
                      strokeWidth={1.5}
                      className="text-slate-400"
                    />
                  </span>
                  <p className="mt-4 text-xs font-semibold text-slate-600">
                    Every voice, in context
                  </p>
                  <p className="mt-2 max-w-64 text-[11px] leading-6 text-slate-500">
                    Your transcript will appear here with speaker labels and
                    timestamps.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 xl:hidden">
                <p className="text-xs text-slate-500">
                  Review the words and confirm who is speaking.
                </p>
                {transcription && (
                  <button
                    onClick={() =>
                      notesResult ? setPanel("notes") : void createNotes()
                    }
                    disabled={busy}
                    className="min-h-11 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {notesResult ? "Review notes" : "Generate notes"}
                  </button>
                )}
              </div>
            </section>
            <section
              aria-labelledby="notes-heading"
              className={`soft-panel animate-enter min-h-72 min-w-0 flex-col xl:flex ${panel === "notes" ? "flex" : "hidden"}`}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <FileText
                  aria-hidden="true"
                  size={17}
                  className="text-slate-500"
                />
                <h2 id="notes-heading" className="text-[13px] font-semibold">
                  Consultation notes
                </h2>
                <span className="ml-auto text-[10px] text-slate-500">
                  {notesResult ? "Ready for review" : "No notes yet"}
                </span>
              </div>
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void createNotes()}
                    disabled={!transcription || busy}
                    className="min-h-11 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {generatingNotes
                      ? "Generating notes…"
                      : notesResult
                        ? "Regenerate notes"
                        : "Generate notes"}
                  </button>
                  {generatingNotes && (
                    <button
                      onClick={cancelNotes}
                      className="min-h-11 px-3 text-xs font-semibold text-slate-600"
                    >
                      Cancel notes
                    </button>
                  )}
                </div>
                {!configuration.notesConfigured && (
                  <p className="mt-3 text-xs leading-6 text-amber-900">
                    Add GROQ_API_KEY and restart the app to generate new notes.
                    The prepared sample works without a key.
                  </p>
                )}
                {notesError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-6 text-red-800"
                  >
                    {notesError}
                  </p>
                )}
              </div>
              {notesResult && transcription ? (
                <NotesEditor
                  result={notesResult}
                  transcript={transcription.transcript}
                  disabled={busy}
                  onPendingEdit={() => setDirty(true)}
                  onChange={(next) => {
                    setNotesResult(next);
                    setDirty(true);
                  }}
                  onSource={focusSource}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-9 text-center">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-teal-50">
                    <FileText
                      aria-hidden="true"
                      size={23}
                      strokeWidth={1.5}
                      className="text-teal-600"
                    />
                  </span>
                  <p className="mt-4 text-xs font-semibold text-slate-600">
                    The details that matter
                  </p>
                  <p className="mt-2 max-w-64 text-[11px] leading-6 text-slate-500">
                    Organized notes, decisions, and next steps linked to the
                    conversation.
                  </p>
                </div>
              )}
            </section>
          </div>
          <p className="mt-6 flex items-start justify-center gap-2 text-[11px] leading-5 text-slate-500">
            <ShieldCheck
              aria-hidden="true"
              size={15}
              className="mt-0.5 shrink-0 text-teal-700"
            />{" "}
            Use fictional conversations in this preview. Always review
            AI-generated content.
          </p>
        </main>
      </div>
    </div>
  );
}
