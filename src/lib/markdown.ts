import {
  consultationRecordSchema,
  type ConsultationRecord,
} from "./consultation";

import { noteSectionTitles as names } from "./languages";
function escape(text: string): string {
  return text.replace(/[\\`*_{}[\]<>#]/g, "\\$&");
}
function time(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function toMarkdown(input: ConsultationRecord): string {
  const record = consultationRecordSchema.parse(input);
  const lines = [
    `# ${escape(record.title.replace(/\s+/g, " "))}`,
    "",
    `Updated: ${record.updatedAt}`,
    `Model: ${escape(record.model)}`,
    `Prompt: ${escape(record.promptVersion)}`,
    "",
    "Reviewed interview demonstration. Verify notes against the transcript.",
    "",
  ];
  if (record.promptVersion.startsWith("sample-v1"))
    lines.push(
      "**Prepared fictional sample — no new audio was transcribed.**",
      "",
    );
  for (const section of record.notesResult.notes.sections) {
    lines.push(`## ${names[section.kind]}`, "");
    for (const item of section.items)
      lines.push(
        `- ${escape(item.text)} ${item.segmentIds
          .map((id) => {
            const n =
              record.transcript.segments.findIndex((s) => s.id === id) + 1;
            return `[${n}](#segment-${n})`;
          })
          .join(" ")}`,
      );
    lines.push("");
  }
  lines.push("## Transcript", "");
  for (const [index, segment] of record.transcript.segments.entries()) {
    const role =
      record.assignments.find((a) => a.speakerId === segment.speakerId)?.role ??
      "unknown";
    const name = record.transcript.details?.names.find(
      (item) => item.speakerId === segment.speakerId,
    )?.name;
    const label =
      role[0].toUpperCase() + role.slice(1) + (name ? ` · ${name}` : "");
    lines.push(
      `### Segment ${index + 1}`,
      "",
      `**${escape(label)}** · ${time(segment.startSeconds)}–${time(segment.endSeconds)}`,
      "",
      escape(segment.text),
      "",
    );
  }
  return lines.join("\n");
}
