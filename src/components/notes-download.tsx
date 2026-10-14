"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, FileText, LoaderCircle } from "lucide-react";
import type { ConsultationRecord } from "@/lib/consultation";
import {
  downloadFilename,
  toPlainText,
  type DownloadFormat,
} from "@/lib/downloads";
import { toMarkdown } from "@/lib/markdown";

export function NotesDownload({
  record,
  disabled,
}: {
  record: ConsultationRecord | null;
  disabled: boolean;
}) {
  const id = useId();
  const picker = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");

  async function download(format: DownloadFormat) {
    if (!record || disabled || active.current) return;
    active.current = true;
    setPreparing(true);
    setError("");
    picker.current?.hidePopover();
    try {
      const blob = new Blob(
        [format === "txt" ? toPlainText(record) : toMarkdown(record)],
        {
          type: `text/${format === "txt" ? "plain" : "markdown"};charset=utf-8`,
        },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFilename(record.title, format);
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(
        "The download could not be prepared. Your notes are saved. Please retry.",
      );
    } finally {
      active.current = false;
      setPreparing(false);
    }
  }

  return (
    <div>
      <button
        popoverTarget={id}
        disabled={disabled || preparing}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold disabled:text-slate-400"
      >
        {preparing ? (
          <LoaderCircle
            aria-hidden="true"
            size={16}
            className="animate-spin motion-reduce:animate-none"
          />
        ) : null}
        {preparing ? "Preparing download…" : "Download notes"}
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      <div
        ref={picker}
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Download format"
        className="fixed inset-0 m-auto h-fit w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl backdrop:bg-slate-900/20"
      >
        <p className="px-3 py-2 text-base font-semibold">Download notes</p>
        {(
          [
            ["txt", "Plain text (.txt)", "Easy to open, copy and edit"],
            ["md", "Markdown (.md)", "Includes conversation and source links"],
          ] as const
        ).map(([format, label, description]) => (
          <button
            key={format}
            onClick={() => void download(format)}
            disabled={disabled || preparing}
            className="flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 disabled:opacity-50"
            aria-label={label}
            aria-describedby={`${id}-${format}-description`}
          >
            <FileText aria-hidden="true" size={20} className="text-slate-500" />
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span
                id={`${id}-${format}-description`}
                className="mt-1 block text-sm text-slate-600"
              >
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>
      {preparing && (
        <span role="status" className="sr-only">
          Preparing your download.
        </span>
      )}
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
