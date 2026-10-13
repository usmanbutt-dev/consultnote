"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  FileText,
  MessageSquareText,
  Plus,
  Save,
  LoaderCircle,
} from "lucide-react";
import { AudioInput } from "./audio-input";
import { TranscriptReview } from "./transcript-review";
import { NotesEditor } from "./notes-editor";
import { ConsultationHistory } from "./consultation-history";
import { ProfileMenu } from "./profile-menu";
import type { DoctorProfile } from "@/lib/account";
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
import { NotesDownload } from "./notes-download";
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
  doctor = null,
}: {
  doctor?: DoctorProfile | null;
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
  const [panel, setPanel] = useState<"transcript" | "notes">("notes");
  const [showConversation, setShowConversation] = useState(false);
  const creation = useRef({ generation: 0, busy: false });
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
  const leaving = useRef(false);
  const [history, setHistory] = useState<
    z.infer<typeof consultationSummarySchema>[]
  >([]);
  const notesRequest = useRef<{
    generation: number;
    controller?: AbortController;
  }>({ generation: 0 });
  const navigation = useRef(0);
  const busy = transcribing || generatingNotes || saving || audioBusy;
  const working = transcribing || generatingNotes;
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
      if (leaving.current) {
        leaving.current = false;
        return;
      }
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

  function cancelCreation() {
    creation.current.generation++;
    creation.current.busy = false;
    cancelTranscription();
    cancelNotes();
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
    cancelCreation();
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
    setShowConversation(false);
    setPanel("notes");
  }

  function acceptAudio(file: File, path?: string) {
    cancelTranscription();
    discardCloudJob();
    setAudio(file);
    setAudioPath(path);
    clearTranscript();
  }

  async function transcribe(): Promise<TranscriptionResult | null> {
    const active = request.current;
    if (!audio || active.busy || audioBusy) return null;
    if (
      transcription &&
      !window.confirm(
        "Transcribe again? A successful result will replace your transcript and role edits.",
      )
    )
      return null;
    const generation = ++active.generation;
    active.controller = new AbortController();
    active.busy = true;
    setTranscribing(true);
    setTranscriptionError("");
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
      if (generation !== active.generation) return null;
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
      const next = {
        transcript: parsed.data.transcript,
        model: parsed.data.model,
        promptVersion: parsed.data.promptVersion,
      };
      setTranscription(next);
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
      return next;
    } catch (error) {
      if (generation !== active.generation) return null;
      setTranscriptionError(
        error instanceof Error && error.message !== "Failed to fetch"
          ? error.message
          : "Could not reach the app. Check your connection and retry.",
      );
      return null;
    } finally {
      if (generation === active.generation) {
        active.busy = false;
        setTranscribing(false);
      }
    }
  }

  async function createConsultationNotes() {
    const active = creation.current;
    if (busy || active.busy) return;
    const generation = ++active.generation;
    active.busy = true;
    try {
      const source = transcription ?? (await transcribe());
      if (!source || generation !== active.generation) return;
      const roles = transcription
        ? assignments
        : source.transcript.speakers.map((speaker) => ({
            speakerId: speaker.id,
            role: speaker.suggestedRole,
          }));
      await createNotes(source, roles);
    } finally {
      if (generation === active.generation) active.busy = false;
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
  async function createNotes(source = transcription, roles = assignments) {
    if (!source || busy) return;
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
          transcript: source.transcript,
          assignments: roles,
          notesLanguage,
        }),
        signal: controller.signal,
      });
      if (generation !== notesRequest.current.generation) return;
      const parsed = notesResultSchema.safeParse(data);
      if (!parsed.success)
        throw new Error("The notes could not be read. Please retry.");
      const checked = consultationInputSchema.safeParse({
        title: title.trim() || "Untitled consultation",
        transcript: source.transcript,
        assignments: roles,
        notesResult: parsed.data,
        model: source.model,
        promptVersion: source.promptVersion,
      });
      if (!checked.success)
        throw new Error(
          "The notes contain invalid source references. Please retry.",
        );
      setNotesResult(parsed.data);
      setNotesProvenance({
        model: `${source.model} | notes:Groq:${configuration.notesModel}`,
        promptVersion: `${source.promptVersion} | notes:${NOTES_PROMPT_VERSION}/${notesLanguage}`,
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
    setShowConversation(false);
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
  function focusSource(id: string) {
    setShowConversation(true);
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
        className="absolute -top-20 left-4 z-50 rounded-lg bg-white px-4 py-3 font-semibold shadow-lg focus:top-4"
      >
        Skip to workspace
      </a>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex">
        <a
          href="#workspace"
          aria-label="ConsultNote home"
          className="flex items-center gap-3 px-2 text-xl font-semibold"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-teal-700 text-white">
            <AudioLines aria-hidden="true" size={23} />
          </span>
          ConsultNote
        </a>
        <button
          onClick={newConsultation}
          disabled={saving}
          className="mt-8 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus aria-hidden="true" size={17} /> New consultation
        </button>
        <div className="mt-8">
          <ConsultationHistory
            items={history}
            activeId={savedRecord?.id}
            busy={busy}
            onOpen={(id) => void openConsultation(id)}
            onDelete={(id) => void removeConsultation(id)}
          />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8 lg:justify-end">
          <a
            href="#workspace"
            className="flex items-center gap-2 font-semibold lg:hidden"
          >
            <AudioLines
              aria-hidden="true"
              size={22}
              className="text-teal-700"
            />{" "}
            ConsultNote
          </a>
          <ProfileMenu
            profile={doctor}
            disabled={busy}
            onBeforeNavigate={() => {
              if (
                busy ||
                (dirty &&
                  !window.confirm(
                    "Leave this consultation? Unsaved changes will be discarded.",
                  ))
              )
                return false;
              leaving.current = true;
              return true;
            }}
            onNavigationError={() => {
              leaving.current = false;
            }}
          />
        </header>
        <main
          id="workspace"
          tabIndex={-1}
          className={
            "mx-auto px-5 py-8 sm:px-8 sm:py-10 " +
            (transcription ? "max-w-7xl" : "max-w-3xl")
          }
        >
          <details className="mb-6 rounded-lg border border-slate-200 bg-white p-3 lg:hidden">
            <summary className="min-h-9 text-sm font-semibold">
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
              className="mt-3 min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
            >
              New consultation
            </button>
          </details>
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {notesResult ? "Review your notes" : "New consultation"}
              </h1>
              {!transcription && !working && (
                <p className="mt-3 leading-7 text-slate-700">
                  Record a conversation or upload an audio file.
                </p>
              )}
              {notesResult && !working && (
                <p
                  role="status"
                  className="mt-2 text-sm leading-6 text-slate-700"
                >
                  {savedRecord && !dirty
                    ? "All changes saved."
                    : "Draft — review before saving."}
                </p>
              )}
            </div>
            {notesResult && !working && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void save()}
                  disabled={!title.trim() || busy || !dirty}
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500"
                >
                  <Save aria-hidden="true" size={17} />{" "}
                  {saving ? "Saving…" : "Save consultation"}
                </button>
                <NotesDownload
                  record={savedRecord}
                  disabled={!savedRecord || dirty || busy}
                />
              </div>
            )}
          </div>
          {storageError && (
            <p
              role="alert"
              className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
            >
              {storageError}
            </p>
          )}
          {sample && (
            <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <strong>Prepared fictional sample</strong>. This uses an example
              transcript; no new audio was transcribed.
            </p>
          )}
          <div
            className={
              working ||
              (transcription && !audio) ||
              (notesResult && !showConversation)
                ? "hidden"
                : ""
            }
          >
            <AudioInput
              cloud={configuration.cloud}
              disabled={working || saving}
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
            {!transcription && (
              <button
                onClick={() => void loadSample()}
                disabled={busy}
                className="mt-3 min-h-11 text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 disabled:opacity-50"
              >
                Try a sample conversation
              </button>
            )}
          </div>
          {working ? (
            <section
              aria-label="Creating notes"
              className="soft-panel animate-enter flex flex-col items-center gap-5 px-6 py-12 text-center"
            >
              <LoaderCircle
                aria-hidden="true"
                size={30}
                className="animate-spin text-teal-700"
              />
              <p
                role="status"
                aria-live="polite"
                className="text-lg font-semibold"
              >
                {generatingNotes
                  ? "Preparing your notes…"
                  : "Reading the conversation…"}
              </p>
              <p className="text-sm leading-6 text-slate-700">
                This may take a little while. Keep this page open.
              </p>
              <button
                onClick={cancelCreation}
                className="min-h-11 rounded-lg border border-slate-300 px-5 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
            </section>
          ) : (
            <>
              {transcriptionError && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                >
                  {transcriptionError}
                </p>
              )}
              {notesError && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                >
                  {notesError}
                </p>
              )}
              {!notesResult && (audio || transcription) && (
                <div className="mt-6">
                  <button
                    onClick={() => void createConsultationNotes()}
                    disabled={busy}
                    className="min-h-12 rounded-lg bg-teal-700 px-6 text-base font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    Create notes
                  </button>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {transcription
                      ? "Your conversation is ready. You can check it before creating notes."
                      : "Your recording is processed online. The notes will be in English."}
                  </p>
                </div>
              )}
              {transcription && (
                <>
                  <div className="my-6 flex flex-wrap items-end gap-4">
                    {transcription && (
                      <div className="min-w-0 w-full sm:w-auto sm:flex-1">
                        <label
                          htmlFor="consultation-title"
                          className="mb-2 block text-sm font-semibold"
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
                          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base disabled:opacity-60"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setShowConversation(!showConversation);
                        setPanel(showConversation ? "notes" : "transcript");
                      }}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold"
                    >
                      {showConversation
                        ? "Hide conversation"
                        : "View conversation"}
                    </button>
                  </div>
                  {showConversation && notesResult && (
                    <div
                      role="group"
                      aria-label="Workspace panels"
                      className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 xl:hidden"
                    >
                      <button
                        aria-pressed={panel === "notes"}
                        onClick={() => setPanel("notes")}
                        className={
                          "min-h-11 flex-1 rounded-md text-sm font-semibold " +
                          (panel === "notes"
                            ? "bg-slate-100"
                            : "text-slate-600")
                        }
                      >
                        Notes
                      </button>
                      <button
                        aria-pressed={panel === "transcript"}
                        onClick={() => setPanel("transcript")}
                        className={
                          "min-h-11 flex-1 rounded-md text-sm font-semibold " +
                          (panel === "transcript"
                            ? "bg-slate-100"
                            : "text-slate-600")
                        }
                      >
                        Conversation
                      </button>
                    </div>
                  )}
                  <div
                    className={
                      "grid items-start gap-5 " +
                      (showConversation && notesResult ? "xl:grid-cols-2" : "")
                    }
                  >
                    {notesResult && (
                      <section
                        aria-labelledby="notes-heading"
                        className={
                          "soft-panel animate-enter min-w-0 " +
                          (showConversation && panel === "transcript"
                            ? "hidden xl:block"
                            : "")
                        }
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                          <h2
                            id="notes-heading"
                            className="flex items-center gap-2 text-lg font-semibold"
                          >
                            <FileText aria-hidden="true" size={20} />{" "}
                            Consultation notes
                          </h2>
                          <button
                            onClick={() => void createConsultationNotes()}
                            disabled={busy}
                            className="min-h-11 px-2 text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 disabled:opacity-50"
                          >
                            Regenerate notes
                          </button>
                        </div>
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
                      </section>
                    )}
                    {showConversation && (
                      <section
                        aria-labelledby="transcript-heading"
                        className={
                          "soft-panel animate-enter min-w-0 " +
                          (notesResult && panel !== "transcript"
                            ? "hidden xl:block"
                            : "")
                        }
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                          <h2
                            id="transcript-heading"
                            className="flex items-center gap-2 text-lg font-semibold"
                          >
                            <MessageSquareText aria-hidden="true" size={20} />{" "}
                            Conversation transcript
                          </h2>
                          {audio && (
                            <button
                              onClick={() => void transcribe()}
                              disabled={busy}
                              className="min-h-11 px-2 text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 disabled:opacity-50"
                            >
                              Transcribe again
                            </button>
                          )}
                        </div>
                        <TranscriptReview
                          transcript={transcription.transcript}
                          assignments={assignments}
                          disabled={busy}
                          onTranscriptChange={editTranscript}
                          onAssignmentsChange={editAssignments}
                          onPendingEdit={() => setDirty(true)}
                        />
                      </section>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {notesResult && !working && (
            <p className="mt-5 text-sm leading-6 text-slate-700">
              Saving stores the reviewed text, not the recording. Check the
              notes and speaker labels before saving.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
