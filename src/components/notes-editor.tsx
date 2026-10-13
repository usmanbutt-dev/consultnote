"use client";
import { useState } from "react";
import {
  notesSchema,
  type NotesResult,
  type Transcript,
} from "@/lib/consultation";
import { noteSectionTitles as titles } from "@/lib/languages";
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
        <p role="alert" className="text-xs text-red-800">
          {error}
        </p>
      )}
      {result.notes.sections.map((section) => (
        <section
          key={section.kind}
          aria-label={`${titles[section.kind]} notes`}
        >
          <h3 className="mb-3 text-xs font-semibold text-slate-700">
            {titles[section.kind]}
          </h3>
          <ul className="space-y-3">
            {section.items.map((item, index) => (
              <li
                key={index}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <label
                  htmlFor={`note-${section.kind}-${index}`}
                  className="sr-only"
                >
                  {titles[section.kind]} note {index + 1}
                </label>
                <textarea
                  key={item.text}
                  id={`note-${section.kind}-${index}`}
                  defaultValue={item.text}
                  dir="auto"
                  rows={2}
                  disabled={disabled}
                  className="w-full resize-y rounded-md border border-slate-200 bg-white p-2 text-xs leading-6 text-slate-700 disabled:opacity-60"
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-500">Sources</span>
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
                        className="min-h-9 rounded-md border border-teal-200 bg-white px-2 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
