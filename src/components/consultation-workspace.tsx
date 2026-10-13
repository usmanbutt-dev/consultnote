"use client";

import { useState } from "react";
import {
  AudioLines,
  ChevronRight,
  FileAudio,
  FileText,
  FolderOpen,
  HelpCircle,
  Laptop,
  MessageSquareText,
  Mic,
  Plus,
  Save,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

export function ConsultationWorkspace() {
  const [input, setInput] = useState<"record" | "upload">("record");
  const [panel, setPanel] = useState<"transcript" | "notes">("transcript");
  const isRecordingInput = input === "record";

  function newConsultation() {
    setInput("record");
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
          className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold transition-colors hover:border-teal-300 hover:bg-teal-50"
        >
          <Plus aria-hidden="true" size={17} /> New consultation
        </button>
        <div className="mt-9 flex items-center justify-between px-3">
          <h2 className="text-xs font-semibold text-slate-600">
            Recent consultations
          </h2>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            0
          </span>
        </div>
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
          <FolderOpen
            aria-hidden="true"
            size={22}
            className="mx-auto text-slate-400"
          />
          <p className="mt-3 text-xs font-medium text-slate-600">
            No consultations yet
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
            Your saved consultations will appear here.
          </p>
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
            <p className="mt-1 text-[11px] text-slate-500">Local preview</p>
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
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-900">
            Workspace preview
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
            <button
              disabled
              aria-describedby="preview-notice"
              className="flex min-h-11 w-fit items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white opacity-50"
            >
              <Save aria-hidden="true" size={16} /> Save consultation
            </button>
          </div>

          <ol
            aria-label="Consultation steps"
            className="my-7 flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/60 p-4 sm:gap-5"
          >
            {["Capture audio", "Review transcript", "Create notes"].map(
              (step, index) => (
                <li
                  key={step}
                  aria-current={index === 0 ? "step" : undefined}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:text-left"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${index === 0 ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    0{index + 1}
                  </span>
                  <span
                    className={`text-[11px] sm:text-xs ${index === 0 ? "font-semibold text-teal-800" : "text-slate-500"}`}
                  >
                    {step}
                  </span>
                </li>
              ),
            )}
          </ol>

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
                <button
                  aria-pressed={isRecordingInput}
                  onClick={() => setInput("record")}
                  className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-[11px] font-semibold transition-colors ${isRecordingInput ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <Mic aria-hidden="true" size={14} /> Record audio
                </button>
                <button
                  aria-pressed={!isRecordingInput}
                  onClick={() => setInput("upload")}
                  className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-[11px] font-semibold transition-colors ${!isRecordingInput ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <UploadCloud aria-hidden="true" size={15} /> Upload recording
                </button>
              </fieldset>
            </div>
            <div className="capture-surface m-4 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-teal-200/70 px-4 py-7 text-center sm:m-5">
              <span className="microphone-ring mb-5 flex size-14 items-center justify-center rounded-full border border-teal-100 bg-white text-teal-700">
                {isRecordingInput ? (
                  <Mic aria-hidden="true" size={24} strokeWidth={1.7} />
                ) : (
                  <FileAudio aria-hidden="true" size={24} strokeWidth={1.7} />
                )}
              </span>
              <h3 className="text-[15px] font-semibold">
                {isRecordingInput
                  ? "Ready when you are"
                  : "Bring your recording"}
              </h3>
              <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">
                {isRecordingInput
                  ? "Capture both sides of the conversation from your microphone."
                  : "Choose audio to turn the discussion into a transcript and notes."}
              </p>
              <button
                disabled
                aria-describedby="preview-notice"
                className="mt-5 flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-5 text-xs font-semibold text-white opacity-50"
              >
                {isRecordingInput ? (
                  <Mic aria-hidden="true" size={15} />
                ) : (
                  <UploadCloud aria-hidden="true" size={16} />
                )}
                {isRecordingInput ? "Start recording" : "Choose audio file"}
              </button>
              <p className="mt-3 text-[10px] leading-5 text-slate-500">
                MP3, WAV, WebM or OGG · Up to 10 MiB · 10 minutes
              </p>
            </div>
            <p
              id="preview-notice"
              className="px-5 pb-5 text-center text-[11px] leading-5 text-slate-500"
            >
              Audio capture is not enabled in this workspace preview.
            </p>
          </section>

          <div
            role="group"
            aria-label="Workspace panels"
            className="mt-6 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 lg:hidden"
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
          <div className="mt-4 grid gap-5 lg:mt-6 lg:grid-cols-2">
            <section
              aria-labelledby="transcript-heading"
              className={`soft-panel min-h-72 flex-col ${panel === "transcript" ? "flex" : "hidden"} lg:flex`}
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
                  Waiting for audio
                </span>
              </div>
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
              <p className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">
                Review the words and confirm who is speaking.
              </p>
            </section>
            <section
              aria-labelledby="notes-heading"
              className={`soft-panel min-h-72 flex-col ${panel === "notes" ? "flex" : "hidden"} lg:flex`}
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
                  No notes yet
                </span>
              </div>
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
              <p className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">
                Review and edit the notes before saving.
              </p>
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
