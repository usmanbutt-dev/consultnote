"use client";
import { useState } from "react";
import {
  notesSchema,
  type NotesResult,
  type Transcript,
} from "@/lib/consultation";
import { noteSectionTitles as titles } from "@/lib/languages";
import { DocumentTextarea } from "./document-textarea";
export function NotesEditor({
  result,
  transcript,
  disabled,
  onChange,
  onPendingEdit,
  onSource,
}: {
  result: NotesResult;
  transcript: Transcript;
  disabled: boolean;
  onChange: (result: NotesResult) => void;
  onPendingEdit?: () => void;
  onSource: (id: string) => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="space-y-5 px-5 py-5">
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      {result.notes.sections.map((section) => (
        <section
          key={section.kind}
          aria-label={`${titles[section.kind]} notes`}
        >
          <h3 className="mb-3 text-base font-semibold text-slate-800">
            {titles[section.kind]}
          </h3>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <ul
              aria-label={`${titles[section.kind]} bullet points`}
              className="list-disc space-y-2 pl-4 marker:text-teal-700"
            >
              {section.items.map((item, index) => (
                <li key={index} className="pl-1">
                  <label
                    htmlFor={`note-${section.kind}-${index}`}
                    className="sr-only"
                  >
                    {titles[section.kind]} note {index + 1}
                  </label>
                  <DocumentTextarea
                    key={item.text}
                    id={`note-${section.kind}-${index}`}
                    defaultValue={item.text}
                    dir="auto"
                    disabled={disabled}
                    onInput={onPendingEdit}
                    onBlur={(event) => {
                      const text = event.currentTarget.value.trim();
                      const parsed = notesSchema.safeParse({
                        sections: result.notes.sections.map((s) =>
                          s.kind === section.kind
                            ? {
                                ...s,
                                items: s.items.map((n, i) =>
                                  i === index ? { ...n, text } : n,
                                ),
                              }
                            : s,
                        ),
                      });
                      if (!parsed.success) {
                        event.currentTarget.value = item.text;
                        setError(
                          "Note text cannot be empty. The previous wording was kept.",
                        );
                        return;
                      }
                      setError("");
                      if (text !== item.text)
                        onChange({ ...result, notes: parsed.data });
                    }}
                  />
                </li>
              ))}
            </ul>
            <details className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-700">
              <summary className="w-fit rounded-sm">
                See in conversation
              </summary>
              <ol className="mt-3 space-y-3">
                {section.items.map((item, index) => (
                  <li key={index}>
                    <p className="mb-2 text-slate-600">
                      {index + 1}. {item.text}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.segmentIds.map((id) => {
                        const n =
                          transcript.segments.findIndex((s) => s.id === id) + 1;
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={disabled}
                            aria-label={`Source segment ${n}`}
                            onClick={() => onSource(id)}
                            className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            Passage {n}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </section>
      ))}
    </div>
  );
}
