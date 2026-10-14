"use client";

import { useState } from "react";
import {
  assignmentsSchema,
  speakerRoleSchema,
  transcriptSchema,
  type Transcript,
  type SpeakerAssignment,
} from "@/lib/consultation";
import { DocumentTextarea } from "./document-textarea";

function timestamp(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function TranscriptReview({
  transcript,
  assignments,
  disabled = false,
  onTranscriptChange,
  onAssignmentsChange,
  onPendingEdit,
}: {
  transcript: Transcript;
  assignments: SpeakerAssignment[];
  disabled?: boolean;
  onTranscriptChange: (transcript: Transcript) => Promise<boolean>;
  onAssignmentsChange: (assignments: SpeakerAssignment[]) => Promise<void>;
  onPendingEdit?: () => void;
}) {
  const [error, setError] = useState("");

  return (
    <div className="min-w-0 px-5 py-5">
      <details className="text-sm text-slate-700">
        <summary className="cursor-pointer py-2 font-medium underline decoration-slate-300 underline-offset-4">
          Correct speaker labels
        </summary>
        <fieldset
          disabled={disabled}
          className="grid gap-3 sm:grid-cols-2 disabled:opacity-60"
        >
          <legend className="sr-only">Speaker labels</legend>
          {transcript.speakers.map((speaker, index) => (
            <div key={speaker.id} className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor={`role-${speaker.id}`}
                  className="text-sm font-semibold"
                >
                  {transcript.details?.names.find(
                    (name) => name.speakerId === speaker.id,
                  )?.name ?? `Speaker ${index + 1}`}
                </label>
                <select
                  id={`role-${speaker.id}`}
                  aria-label={`Speaker ${index + 1} role`}
                  value={
                    assignments.find((item) => item.speakerId === speaker.id)
                      ?.role ?? "unknown"
                  }
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  onChange={(event) => {
                    const role = speakerRoleSchema.safeParse(
                      event.currentTarget.value,
                    );
                    if (!role.success) return;
                    const next = assignmentsSchema.safeParse(
                      assignments.map((item) =>
                        item.speakerId === speaker.id
                          ? { ...item, role: role.data }
                          : item,
                      ),
                    );
                    if (next.success) onAssignmentsChange(next.data);
                  }}
                >
                  <option value="doctor">Doctor</option>
                  <option value="patient">Patient</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>
          ))}
        </fieldset>
      </details>
      {error && (
        <p role="alert" className="mt-4 text-sm leading-6 text-red-800">
          {error}
        </p>
      )}
      <ol
        aria-label="Transcript document"
        className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        {transcript.segments.map((segment, index) => {
          const speakerIndex = transcript.speakers.findIndex(
            (speaker) => speaker.id === segment.speakerId,
          );
          const role =
            assignments.find((item) => item.speakerId === segment.speakerId)
              ?.role ?? "unknown";
          const name = transcript.details?.names.find(
            (item) => item.speakerId === segment.speakerId,
          )?.name;
          const label =
            role === "unknown"
              ? `Speaker ${speakerIndex + 1}`
              : role[0].toUpperCase() + role.slice(1);
          const duplicateLabel =
            role !== "unknown" &&
            assignments.filter(
              (item) =>
                item.role === role &&
                transcript.details?.names.find(
                  (entry) => entry.speakerId === item.speakerId,
                )?.name === name,
            ).length > 1;
          return (
            <li
              key={`${segment.id}:${segment.text}`}
              id={`transcript-${segment.id}`}
              className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <h3 className="text-sm font-semibold text-slate-800">
                  {label}
                  {name ? ` · ${name}` : ""}
                  {duplicateLabel ? ` · Speaker ${speakerIndex + 1}` : ""}
                </h3>
                <span className="font-mono text-slate-500">
                  ~{timestamp(segment.startSeconds)}–
                  {timestamp(segment.endSeconds)}
                </span>
              </div>
              <label htmlFor={`text-${segment.id}`} className="sr-only">
                Transcript segment {index + 1}
              </label>
              <DocumentTextarea
                id={`text-${segment.id}`}
                defaultValue={segment.text}
                disabled={disabled}
                dir="auto"
                onInput={onPendingEdit}
                onBlur={async (event) => {
                  const input = event.currentTarget;
                  const text = event.currentTarget.value.trim();
                  const next = transcriptSchema.safeParse({
                    ...transcript,
                    details:
                      text !== segment.text && transcript.details
                        ? {
                            names: transcript.details.names.filter(
                              (name) => !name.segmentIds.includes(segment.id),
                            ),
                            concern:
                              transcript.details.concern?.segmentIds.includes(
                                segment.id,
                              )
                                ? null
                                : transcript.details.concern,
                          }
                        : transcript.details,
                    segments: transcript.segments.map((item) =>
                      item.id === segment.id
                        ? { ...item, text: event.currentTarget.value }
                        : item,
                    ),
                  });
                  if (!next.success) {
                    event.currentTarget.value = segment.text;
                    setError(
                      "Transcript text cannot be empty. The previous words were kept.",
                    );
                    return;
                  }
                  setError("");
                  if (!(await onTranscriptChange(next.data)))
                    input.value = segment.text;
                }}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
