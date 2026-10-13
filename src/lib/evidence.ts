import { createHash } from "node:crypto";
import {
  assignmentsSchema,
  transcriptSchema,
  type SpeakerAssignment,
  type Transcript,
} from "./consultation";

export function sourceDigest(
  transcript: Transcript,
  assignments: SpeakerAssignment[],
): string {
  const reviewedTranscript = transcriptSchema.parse(transcript);
  const reviewedAssignments = assignmentsSchema
    .parse(assignments)
    .sort((a, b) =>
      a.speakerId < b.speakerId ? -1 : a.speakerId > b.speakerId ? 1 : 0,
    );

  return createHash("sha256")
    .update(
      JSON.stringify({
        transcript: reviewedTranscript,
        assignments: reviewedAssignments,
      }),
    )
    .digest("hex");
}
