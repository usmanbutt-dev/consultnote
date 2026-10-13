import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/notes/route";
import { generateNotes } from "@/lib/groq";
import transcript from "../fixtures/transcript.json";
import notes from "../fixtures/notes.json";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ requireOwner: async () => null }));
vi.mock("@/lib/groq", () => ({
  generateNotes: vi.fn(async () => ({ notes })),
}));
afterEach(() => vi.clearAllMocks());
it("rejects non-English note output requests before provider work", async () => {
  const response = await POST(
    new Request("http://localhost/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript,
        assignments: transcript.speakers.map((s) => ({
          speakerId: s.id,
          role: s.suggestedRole,
        })),
        notesLanguage: "ur",
      }),
    }),
  );
  expect(response.status).toBe(400);
  expect(generateNotes).not.toHaveBeenCalled();
});
