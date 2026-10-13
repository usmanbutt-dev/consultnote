import { describe, expect, it } from "vitest";
import {
  assignmentsSchema,
  consultationInputSchema,
  notesSchema,
  transcriptSchema,
  validateNotes,
} from "@/lib/consultation";
import { sourceDigest } from "@/lib/evidence";
import transcriptFixture from "../fixtures/transcript.json";
import notesFixture from "../fixtures/notes.json";

function transcript() {
  return transcriptSchema.parse(structuredClone(transcriptFixture));
}

const assignments = [
  { speakerId: "speaker-1", role: "doctor" as const },
  { speakerId: "speaker-2", role: "patient" as const },
];

function consultation() {
  return {
    title: "Fictional consultation",
    transcript: structuredClone(transcriptFixture),
    assignments: structuredClone(assignments),
    notesResult: {
      notes: structuredClone(notesFixture),
      sourceDigest: "0".repeat(64),
    },
    model: "test-model",
    promptVersion: "2026-10-13",
  };
}

describe("transcript validation", () => {
  it("accepts a complete speaker-labeled conversation", () => {
    expect(transcriptSchema.safeParse(transcriptFixture).success).toBe(true);
  });

  it("rejectsDuplicateSpeakerIds", () => {
    const input = transcript();
    input.speakers.push({ ...input.speakers[0] });
    expect(transcriptSchema.safeParse(input).success).toBe(false);
  });

  it("rejects duplicate segment IDs", () => {
    const input = transcript();
    input.segments[1].id = input.segments[0].id;
    expect(transcriptSchema.safeParse(input).success).toBe(false);
  });

  it("rejectsUnknownSegmentSpeaker", () => {
    const input = transcript();
    input.segments[0].speakerId = "missing-speaker";
    expect(transcriptSchema.safeParse(input).success).toBe(false);
  });

  it("retainsThirdUnknownSpeaker", () => {
    const input = transcript();
    input.speakers.push({
      id: "speaker-3",
      suggestedRole: "unknown",
      reason: "Role is unclear.",
    });
    input.segments.push({
      id: "segment-5",
      speakerId: "speaker-3",
      startSeconds: 66,
      endSeconds: 70,
      text: "I'll join you.",
    });
    expect(transcriptSchema.parse(input).speakers[2].suggestedRole).toBe(
      "unknown",
    );
  });

  it.each([
    { startSeconds: -1, endSeconds: 8 },
    { startSeconds: 8, endSeconds: 7 },
    { startSeconds: 0, endSeconds: 92 },
    { startSeconds: Number.NaN, endSeconds: 8 },
  ])("rejects invalid timestamps: %j", (timestamps) => {
    const input = transcript();
    Object.assign(input.segments[0], timestamps);
    expect(transcriptSchema.safeParse(input).success).toBe(false);
  });

  it("rejects segments with nonchronological start times", () => {
    const input = transcript();
    [input.segments[0], input.segments[1]] = [
      input.segments[1],
      input.segments[0],
    ];
    expect(transcriptSchema.safeParse(input).success).toBe(false);
  });

  it("enforces the ten-minute duration boundary", () => {
    expect(
      transcriptSchema.safeParse({ ...transcriptFixture, durationSeconds: 600 })
        .success,
    ).toBe(true);
    expect(
      transcriptSchema.safeParse({ ...transcriptFixture, durationSeconds: 601 })
        .success,
    ).toBe(false);
  });
});

describe("note evidence", () => {
  it("accepts notes linked to existing transcript segments", () => {
    expect(() =>
      validateNotes(notesSchema.parse(notesFixture), transcript()),
    ).not.toThrow();
  });

  it("rejectsMissingEvidence", () => {
    const input = structuredClone(notesFixture);
    input.sections[0].items[0].segmentIds = [];
    expect(notesSchema.safeParse(input).success).toBe(false);
  });

  it("rejectsUnknownEvidenceId", () => {
    const input = notesSchema.parse(structuredClone(notesFixture));
    input.sections[0].items[0].segmentIds = ["missing-segment"];
    expect(() => validateNotes(input, transcript())).toThrow();
  });

  it("rejectsDuplicateSectionKinds", () => {
    const input = structuredClone(notesFixture);
    input.sections.push(structuredClone(input.sections[0]));
    expect(notesSchema.safeParse(input).success).toBe(false);
  });

  it("rejects empty sections and unsupported section kinds", () => {
    expect(notesSchema.safeParse({ sections: [] }).success).toBe(false);
    expect(
      notesSchema.safeParse({ sections: [{ kind: "diagnosis", items: [] }] })
        .success,
    ).toBe(false);
  });
});

describe("consultation save contract", () => {
  it("trims titles and accepts a complete reviewed payload", () => {
    const input = consultation();
    input.title = "  Fictional consultation  ";
    expect(consultationInputSchema.parse(input).title).toBe(
      "Fictional consultation",
    );
  });

  it.each(["", " ", "x".repeat(121)])("rejects invalid title %j", (title) => {
    expect(
      consultationInputSchema.safeParse({ ...consultation(), title }).success,
    ).toBe(false);
  });

  it("rejects duplicate speaker assignments", () => {
    expect(
      assignmentsSchema.safeParse([assignments[0], assignments[0]]).success,
    ).toBe(false);
  });

  it("requires an assignment for every transcript speaker", () => {
    const input = consultation();
    input.assignments.pop();
    expect(consultationInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects assignments for speakers absent from the transcript", () => {
    const input = consultation();
    input.assignments[0].speakerId = "missing-speaker";
    expect(consultationInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects saved notes that cite a missing segment", () => {
    const input = consultation();
    input.notesResult.notes.sections[0].items[0].segmentIds = [
      "missing-segment",
    ];
    expect(consultationInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("note source identity", () => {
  it("digestChangesWhenTranscriptOrRolesChange", () => {
    const original = transcript();
    const changed = transcript();
    changed.segments[1].text = "The headaches began Tuesday.";
    const digest = sourceDigest(original, assignments);
    expect(sourceDigest(changed, assignments)).not.toBe(digest);
    expect(
      sourceDigest(original, [
        { ...assignments[0], role: "unknown" },
        assignments[1],
      ]),
    ).not.toBe(digest);
  });

  it("digestIgnoresAssignmentOrder", () => {
    const input = transcript();
    expect(sourceDigest(input, assignments)).toBe(
      sourceDigest(input, [...assignments].reverse()),
    );
  });

  it("returns a SHA-256 identity without mutating reviewed data", () => {
    const input = transcript();
    const reviewed = [...assignments].reverse();
    const before = structuredClone({ input, reviewed });
    expect(sourceDigest(input, reviewed)).toMatch(/^[a-f0-9]{64}$/);
    expect({ input, reviewed }).toEqual(before);
  });
});
