import "server-only";
import {
  consultationInputSchema,
  transcriptSchema,
  notesSchema,
  type ConsultationInput,
} from "./consultation";
import { sourceDigest } from "./evidence";
import rawTranscript from "../data/sample-transcript.json";
import rawNotes from "../data/sample-notes.json";
export function sampleConsultation(): ConsultationInput {
  const transcript = transcriptSchema.parse(rawTranscript);
  const assignments = transcript.speakers.map((s) => ({
    speakerId: s.id,
    role: s.suggestedRole,
  }));
  return consultationInputSchema.parse({
    title: "Fictional follow-up consultation",
    transcript,
    assignments,
    notesResult: {
      notes: notesSchema.parse(rawNotes),
      sourceDigest: sourceDigest(transcript, assignments),
    },
    model: "Prepared fictional sample",
    promptVersion: "sample-v1",
  });
}
