"use client";

import { useState } from "react";
import {
  assignmentsSchema,
  speakerRoleSchema,
  transcriptSchema,
  type Transcript,
  type SpeakerAssignment,
} from "@/lib/consultation";

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
}: {
  transcript: Transcript;
  assignments: SpeakerAssignment[];
  disabled?: boolean;
  onTranscriptChange: (transcript: Transcript) => void;
  onAssignmentsChange: (assignments: SpeakerAssignment[]) => void;
}) {
  const [error, setError] = useState("");

  return (
    <div className="min-w-0 px-5 py-5">
      <p className="text-xs leading-6 text-slate-500">
        Timestamps are approximate. Check the words and suggested roles against
        the audio.
      </p>
      <fieldset
        disabled={disabled}
        className="mt-4 space-y-3 disabled:opacity-60"
      >
        <legend className="mb-3 text-xs font-semibold text-slate-700">
          Review speaker roles
        </legend>
        {transcript.speakers.map((speaker, index) => (
          <div
            key={speaker.id}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={`role-${speaker.id}`}
                className="text-xs font-semibold"
              >
                Speaker {index + 1} role
              </label>
              <select
                id={`role-${speaker.id}`}
                value={
                  assignments.find((item) => item.speakerId === speaker.id)
                    ?.role ?? "unknown"
                }
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs"
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
            <p className="mt-2 text-[11px] font-medium capitalize text-teal-800">
              Suggested: {speaker.suggestedRole}
            </p>
            <p className="mt-1 break-words text-[11px] leading-5 text-slate-500">
              {speaker.reason}
            </p>
          </div>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="mt-4 text-xs leading-6 text-red-800">
          {error}
        </p>
      )}
      <ol className="mt-5 space-y-4">
        {transcript.segments.map((segment, index) => {
          const speakerIndex = transcript.speakers.findIndex(
            (speaker) => speaker.id === segment.speakerId,
          );
          const role =
            assignments.find((item) => item.speakerId === segment.speakerId)
              ?.role ?? "unknown";
          return (
            <li
              key={`${segment.id}:${segment.text}`}
              id={`transcript-${segment.id}`}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <span className="rounded-md bg-teal-50 px-2 py-1 font-semibold capitalize text-teal-800">
                  Speaker {speakerIndex + 1} · {role}
                </span>
                <span className="font-mono text-slate-500">
                  ~{timestamp(segment.startSeconds)}–
                  {timestamp(segment.endSeconds)}
                </span>
              </div>
              <label htmlFor={`text-${segment.id}`} className="sr-only">
                Transcript segment {index + 1}
              </label>
              <textarea
                id={`text-${segment.id}`}
                defaultValue={segment.text}
                disabled={disabled}
                rows={3}
                className="w-full resize-y rounded-md border border-slate-200 bg-white p-2 text-xs leading-6 text-slate-700 disabled:opacity-60"
                onBlur={(event) => {
                  const next = transcriptSchema.safeParse({
                    ...transcript,
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
                  onTranscriptChange(next.data);
                }}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
