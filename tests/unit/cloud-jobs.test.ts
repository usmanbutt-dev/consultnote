import { beforeEach, expect, it, vi } from "vitest";
import { startJob, pollJob } from "@/lib/cloud-jobs";
import { adminSupabase } from "@/lib/supabase/server";
import { submitAssemblyJob, pollAssemblyJob } from "@/lib/assemblyai";
import { storedAudio } from "@/lib/cloud-audio";
import { removeStoredAudio } from "@/lib/cloud-audio";
import { ApiError } from "@/lib/http";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ adminSupabase: vi.fn() }));
vi.mock("@/lib/cloud-audio", () => ({
  validateAudioPath: (p: string) => p,
  storedAudio: vi.fn(),
  removeStoredAudio: vi.fn(async () => {}),
}));
vi.mock("@/lib/assemblyai", () => ({
  submitAssemblyJob: vi.fn(),
  pollAssemblyJob: vi.fn(),
}));
vi.mock("@/lib/ai", () => ({ addRoleSuggestions: vi.fn() }));
const userId = "9d617a5e-8818-4abb-a18a-04afbdce3757";
const id = "339e2554-973d-45d8-bd31-5f26a725fff7";
const input = { id, path: `${userId}/${id}.mp3`, language: "en-ur" as const };
const job = {
  id,
  user_id: userId,
  audio_path: input.path,
  language: "en-ur",
  duration_seconds: 30,
  provider_id: "provider-1",
  status: "processing",
  result: null,
  failure: null,
  lease_until: null,
  created_at: new Date().toISOString(),
};
let query: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  query = Object.fromEntries(
    ["select", "eq", "in", "or", "update"].map((name) => [
      name,
      vi.fn(() => query),
    ]),
  );
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  query.then = vi.fn((resolve) => resolve({ data: null, error: null }));
  vi.mocked(adminSupabase).mockReturnValue({
    from: vi.fn(() => query),
    rpc: vi.fn(async () => ({ data: true, error: null })),
  } as unknown as ReturnType<typeof adminSupabase>);
});
it("does not call the provider for a job absent from the verified owner's query", async () => {
  await expect(pollJob(userId, id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(query.eq).toHaveBeenCalledWith("user_id", userId);
  expect(pollAssemblyJob).not.toHaveBeenCalled();
});
it("returns an existing submitted job without submitting again", async () => {
  query.maybeSingle.mockResolvedValue({ data: job, error: null });
  expect(await startJob(userId, input)).toEqual({ id, status: "processing" });
  expect(storedAudio).not.toHaveBeenCalled();
  expect(submitAssemblyJob).not.toHaveBeenCalled();
});
it("polls an existing provider ID once and keeps pending work resumable", async () => {
  query.maybeSingle.mockResolvedValue({ data: job, error: null });
  vi.mocked(pollAssemblyJob).mockResolvedValue(null);
  expect(await pollJob(userId, id)).toEqual({ id, status: "processing" });
  expect(pollAssemblyJob).toHaveBeenCalledWith(
    "provider-1",
    30,
    expect.any(AbortSignal),
  );
  expect(pollAssemblyJob).toHaveBeenCalledTimes(1);
  expect(submitAssemblyJob).not.toHaveBeenCalled();
});
it("marks a terminal provider failure and removes its temporary recording", async () => {
  query.maybeSingle.mockResolvedValue({ data: job, error: null });
  vi.mocked(pollAssemblyJob).mockRejectedValue(
    new ApiError(
      "AI_PROCESSING_FAILED",
      "The recording could not be processed.",
      503,
    ),
  );
  expect(await pollJob(userId, id)).toMatchObject({
    id,
    status: "failed",
    failure: { code: "AI_PROCESSING_FAILED" },
  });
  expect(removeStoredAudio).toHaveBeenCalledWith(input.path, userId);
});
