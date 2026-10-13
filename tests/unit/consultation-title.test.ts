import { expect, it } from "vitest";
import { suggestedConsultationTitle } from "@/lib/consultation-title";
import fixture from "../fixtures/transcript.json";
import { transcriptSchema } from "@/lib/consultation";

const original = transcriptSchema.parse(fixture);

it("uses the spoken patient name, complaint and session date", () => {
  const transcript = {
    ...original,
    details: {
      names: [
        {
          speakerId: "speaker-2",
          name: "Mr. Jones",
          segmentIds: ["segment-1"],
        },
      ],
      concern: { label: "Back pain", segmentIds: ["segment-2"] },
    },
  };
  expect(suggestedConsultationTitle(transcript, new Date(2026, 9, 14))).toBe(
    "Mr. Jones – Back pain – 14 Oct 2026",
  );
});

it("does not invent an identity or diagnosis when details are absent", () => {
  expect(suggestedConsultationTitle(original, new Date(2026, 9, 14))).toBe(
    "Patient – Consultation – 14 Oct 2026",
  );
});

it("keeps the suggested title within the existing save limit", () => {
  expect(
    suggestedConsultationTitle(
      {
        ...original,
        details: {
          names: [
            {
              speakerId: "speaker-2",
              name: "N".repeat(80),
              segmentIds: ["segment-1"],
            },
          ],
          concern: { label: "C".repeat(80), segmentIds: ["segment-2"] },
        },
      },
      new Date(2026, 9, 14),
    ).length,
  ).toBeLessThanOrEqual(120);
});

it("uses a generic patient label when multiple voices are assigned as patients", () => {
  const transcript = {
    ...original,
    speakers: original.speakers.map((speaker) => ({
      ...speaker,
      suggestedRole: "patient" as const,
    })),
    details: {
      names: [
        { speakerId: "speaker-1", name: "Alex", segmentIds: ["segment-1"] },
      ],
      concern: null,
    },
  };
  expect(suggestedConsultationTitle(transcript, new Date(2026, 9, 14))).toBe(
    "Patient – Consultation – 14 Oct 2026",
  );
});
