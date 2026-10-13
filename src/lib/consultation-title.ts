import type { Transcript } from "./consultation";

export function suggestedConsultationTitle(
  transcript: Transcript,
  date = new Date(),
): string {
  const patients = transcript.speakers.filter(
    (speaker) => speaker.suggestedRole === "patient",
  );
  const patient = patients.length === 1 ? patients[0] : undefined;
  const name =
    transcript.details?.names.find((item) => item.speakerId === patient?.id)
      ?.name ?? "Patient";
  const concern = transcript.details?.concern?.label ?? "Consultation";
  const sessionDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  return `${name.slice(0, 40)} – ${concern.slice(0, 50)} – ${sessionDate}`;
}
