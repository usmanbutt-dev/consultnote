import { beforeEach, expect, it, vi } from "vitest";
import { POST as notes } from "@/app/api/notes/route";
import { POST as transcribe } from "@/app/api/transcribe/route";
import { GET as consultations } from "@/app/api/consultations/route";
import { POST as jobs } from "@/app/api/transcribe/jobs/route";
import { requireOwner, reserveProcessing } from "@/lib/supabase/server";
import { generateNotes } from "@/lib/groq";
import { transcribeAudio } from "@/lib/ai";
import { ApiError } from "@/lib/http";
import transcript from "../fixtures/transcript.json";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  requireOwner: vi.fn(),
  reserveProcessing: vi.fn(),
  adminSupabase: vi.fn(),
}));
vi.mock("@/lib/groq", () => ({ generateNotes: vi.fn() }));
vi.mock("@/lib/ai", () => ({
  transcribeAudio: vi.fn(),
  addRoleSuggestions: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockRejectedValue(
    new ApiError("UNAUTHORIZED", "Sign in to open your workspace.", 401),
  );
});
it.each([notes, transcribe, jobs])(
  "rejects anonymous cloud processing before parsing audio or calling providers",
  async (route) => {
    const result = await route(
      new Request("http://localhost/api", { method: "POST" }),
    );
    expect(result.status).toBe(401);
    expect(generateNotes).not.toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(reserveProcessing).not.toHaveBeenCalled();
  },
);
it("does not expose local SQLite history after a cloud sign-in failure", async () => {
  expect((await consultations()).status).toBe(401);
});
it("rejects the old multipart transcription route for a cloud user", async () => {
  vi.mocked(requireOwner).mockResolvedValue({
    userId: "owner",
    client: {},
  } as Awaited<ReturnType<typeof requireOwner>>);
  const result = await transcribe(
    new Request("http://localhost/api", { method: "POST" }),
  );
  expect(result.status).toBe(400);
  expect(transcribeAudio).not.toHaveBeenCalled();
});

it("stops before generation when the server-side notes budget is exhausted", async () => {
  vi.mocked(requireOwner).mockResolvedValue({
    userId: "owner",
    client: {},
  } as Awaited<ReturnType<typeof requireOwner>>);
  vi.mocked(reserveProcessing).mockRejectedValue(
    new ApiError("PROCESSING_LIMIT", "Demo budget reached.", 429),
  );
  const result = await notes(
    new Request("http://localhost/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript,
        assignments: transcript.speakers.map((speaker) => ({
          speakerId: speaker.id,
          role: speaker.suggestedRole,
        })),
      }),
    }),
  );
  expect(result.status).toBe(429);
  expect(reserveProcessing).toHaveBeenCalledWith("owner", "notes");
  expect(generateNotes).not.toHaveBeenCalled();
});
