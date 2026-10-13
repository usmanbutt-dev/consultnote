import { afterEach, expect, it, vi } from "vitest";
import { uploadCloudAudio } from "@/lib/cloud-client";
import { browserSupabase } from "@/lib/supabase/browser";
vi.mock("@/lib/supabase/browser", () => ({ browserSupabase: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
it("uploads a large recording directly to private storage and validates using small JSON", async () => {
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  vi.mocked(browserSupabase).mockReturnValue({
    auth: {
      getUser: async () => ({ data: { user: { id: "owner" } }, error: null }),
    },
    storage: { from: () => ({ upload, remove }) },
  } as unknown as ReturnType<typeof browserSupabase>);
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({ mimeType: "audio/mpeg", durationSeconds: 300 }),
  );
  vi.stubGlobal("fetch", fetch);
  const file = new File([new Uint8Array(7 * 1024 * 1024)], "conversation.mp3", {
    type: "audio/mpeg",
  });
  const result = await uploadCloudAudio(file, new AbortController().signal);
  expect(upload).toHaveBeenCalledWith(
    expect.stringMatching(/^owner\/[0-9a-f-]+\.mp3$/),
    file,
    expect.objectContaining({ upsert: false }),
  );
  expect(typeof fetch.mock.calls[0][1]?.body).toBe("string");
  expect(String(fetch.mock.calls[0][1]?.body).length).toBeLessThan(200);
  expect(result.path).toMatch(/^owner\//);
  expect(remove).not.toHaveBeenCalled();
});
