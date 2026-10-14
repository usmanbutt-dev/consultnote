import { z } from "zod";

// Browser validation must work without CSP-blocked code generation.
z.config({ jitless: true });

const nonemptyText = z.string().trim().min(1);
export const speakerRoleSchema = z.enum(["doctor", "patient", "unknown"]);

export const speakerSchema = z.strictObject({
  id: nonemptyText,
  suggestedRole: speakerRoleSchema,
  reason: nonemptyText,
});

export const conversationDetailsSchema = z.strictObject({
  names: z.array(
    z.strictObject({
      speakerId: nonemptyText,
      name: nonemptyText.max(80),
      segmentIds: z.array(nonemptyText).min(1),
    }),
  ),
  concern: z
    .strictObject({
      label: nonemptyText.max(80),
      segmentIds: z.array(nonemptyText).min(1),
    })
    .nullable(),
});

export const segmentSchema = z
  .strictObject({
    id: nonemptyText,
    speakerId: nonemptyText,
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().nonnegative(),
    text: nonemptyText,
  })
  .refine((segment) => segment.endSeconds >= segment.startSeconds, {
    message: "A segment must end at or after its start.",
    path: ["endSeconds"],
  });

export const transcriptSchema = z
  .strictObject({
    durationSeconds: z.number().positive().max(600),
    speakers: z.array(speakerSchema).min(1),
    segments: z.array(segmentSchema).min(1),
    details: conversationDetailsSchema.optional(),
  })
  .superRefine((transcript, context) => {
    const speakerIds = new Set(
      transcript.speakers.map((speaker) => speaker.id),
    );
    const segmentIds = new Set<string>();

    if (speakerIds.size !== transcript.speakers.length) {
      context.addIssue({
        code: "custom",
        path: ["speakers"],
        message: "Speaker IDs must be unique.",
      });
    }

    for (const [index, segment] of transcript.segments.entries()) {
      if (segmentIds.has(segment.id)) {
        context.addIssue({
          code: "custom",
          path: ["segments", index, "id"],
          message: "Segment IDs must be unique.",
        });
      }
      segmentIds.add(segment.id);

      if (!speakerIds.has(segment.speakerId)) {
        context.addIssue({
          code: "custom",
          path: ["segments", index, "speakerId"],
          message: "The segment must reference an existing speaker.",
        });
      }
      if (segment.endSeconds > transcript.durationSeconds + 1) {
        context.addIssue({
          code: "custom",
          path: ["segments", index, "endSeconds"],
          message: "The segment extends beyond the recording.",
        });
      }
      if (
        index > 0 &&
        segment.startSeconds < transcript.segments[index - 1].startSeconds
      ) {
        context.addIssue({
          code: "custom",
          path: ["segments", index, "startSeconds"],
          message: "Segments must have chronological start times.",
        });
      }
    }
    if (transcript.details) {
      const { names, concern } = transcript.details;
      if (
        new Set(names.map((name) => name.speakerId)).size !== names.length ||
        names.some((name) => !speakerIds.has(name.speakerId)) ||
        [...names, ...(concern ? [concern] : [])].some((item) =>
          item.segmentIds.some((id) => !segmentIds.has(id)),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["details"],
          message:
            "Conversation details must reference existing speakers and segments.",
        });
      }
    }
  });

export const speakerAssignmentSchema = z.strictObject({
  speakerId: nonemptyText,
  role: speakerRoleSchema,
});

export const assignmentsSchema = z
  .array(speakerAssignmentSchema)
  .min(1)
  .refine(
    (assignments) =>
      new Set(assignments.map((assignment) => assignment.speakerId)).size ===
      assignments.length,
    { message: "Each speaker must have exactly one role assignment." },
  );

export const reviewedInputSchema = z
  .strictObject({
    transcript: transcriptSchema,
    assignments: assignmentsSchema,
  })
  .refine(
    ({ transcript, assignments }) =>
      assignments.length === transcript.speakers.length &&
      assignments.every((a) =>
        transcript.speakers.some((s) => s.id === a.speakerId),
      ),
    {
      message: "Assign a role to every transcript speaker.",
      path: ["assignments"],
    },
  );

export const noteItemSchema = z.strictObject({
  text: nonemptyText,
  segmentIds: z.array(nonemptyText).min(1),
});

export const noteSectionSchema = z.strictObject({
  kind: z.enum([
    "discussion",
    "explanations",
    "decisions",
    "followUp",
    "context",
  ]),
  items: z.array(noteItemSchema).min(1),
});

export const notesSchema = z
  .strictObject({
    sections: z.array(noteSectionSchema).min(1),
  })
  .refine(
    (notes) =>
      new Set(notes.sections.map((section) => section.kind)).size ===
      notes.sections.length,
    { message: "Note sections must have unique kinds.", path: ["sections"] },
  );

export const notesResultSchema = z.strictObject({
  notes: notesSchema,
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

export function validateNotes(notes: Notes, transcript: Transcript): void {
  const segmentIds = new Set(transcript.segments.map((segment) => segment.id));
  for (const section of notesSchema.parse(notes).sections) {
    for (const item of section.items) {
      if (item.segmentIds.some((id) => !segmentIds.has(id))) {
        throw new Error("Notes must reference existing transcript segments.");
      }
    }
  }
}

export const consultationInputSchema = z
  .strictObject({
    title: nonemptyText.max(120),
    transcript: transcriptSchema,
    assignments: assignmentsSchema,
    notesResult: notesResultSchema,
    model: nonemptyText,
    promptVersion: nonemptyText,
  })
  .superRefine((input, context) => {
    const speakerIds = new Set(
      input.transcript.speakers.map((speaker) => speaker.id),
    );
    if (
      input.assignments.length !== speakerIds.size ||
      input.assignments.some(
        (assignment) => !speakerIds.has(assignment.speakerId),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["assignments"],
        message:
          "Assign a role to every transcript speaker, preserving unknown roles.",
      });
    }
    try {
      validateNotes(input.notesResult.notes, input.transcript);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["notesResult", "notes"],
        message: "Notes must reference existing transcript segments.",
      });
    }
  });

export const consultationRecordSchema = consultationInputSchema.safeExtend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const consultationSummarySchema = z.strictObject({
  id: z.uuid(),
  title: nonemptyText.max(120),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SpeakerRole = z.infer<typeof speakerRoleSchema>;
export type Speaker = z.infer<typeof speakerSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;
export type SpeakerAssignment = z.infer<typeof speakerAssignmentSchema>;
export type NoteItem = z.infer<typeof noteItemSchema>;
export type NoteSection = z.infer<typeof noteSectionSchema>;
export type Notes = z.infer<typeof notesSchema>;
export type NotesResult = z.infer<typeof notesResultSchema>;
export type ConsultationInput = z.infer<typeof consultationInputSchema>;
export type ConsultationRecord = z.infer<typeof consultationRecordSchema>;
export type ConsultationSummary = z.infer<typeof consultationSummarySchema>;
