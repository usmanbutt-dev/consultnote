import {
  consultationRecordSchema,
  type ConsultationRecord,
} from "./consultation";
import { noteSectionTitles } from "./languages";

export type DownloadFormat = "pdf" | "txt" | "md";

export function downloadFilename(
  title: string,
  format: DownloadFormat,
): string {
  let name = title
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    name = `Consultation - ${name}`;
  let stem = "";
  const encoder = new TextEncoder();
  for (const character of name) {
    if (encoder.encode(stem + character).length > 180) break;
    stem += character;
  }
  return `${stem.replace(/[. ]+$/, "") || "Consultation"}.${format}`;
}

export function savedDate(record: ConsultationRecord): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(record.updatedAt));
}

export function toPlainText(input: ConsultationRecord): string {
  const record = consultationRecordSchema.parse(input);
  const lines = [
    record.title,
    "Consultation notes",
    `Last saved: ${savedDate(record)}`,
    "",
  ];
  if (record.promptVersion.startsWith("sample-v1"))
    lines.push("Prepared fictional sample — no new audio was transcribed.", "");
  for (const section of record.notesResult.notes.sections) {
    lines.push(noteSectionTitles[section.kind]);
    for (const item of section.items) lines.push(`- ${item.text}`);
    lines.push("");
  }
  lines.push("AI-assisted notes. Verify against the conversation.");
  return lines.join("\n");
}
