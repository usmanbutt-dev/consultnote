import { afterEach, expect, it, vi } from "vitest";
import { cloudMode, supabaseConfiguration } from "@/lib/supabase/config";
import { validateAudioPath } from "@/lib/cloud-audio";

vi.mock("server-only", () => ({}));
const owner = "9d617a5e-8818-4abb-a18a-04afbdce3757";
afterEach(() => vi.unstubAllEnvs());
it("keeps local mode without Supabase but fails closed on Vercel", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("VERCEL", "");
  expect(cloudMode()).toBe(false);
  vi.stubEnv("VERCEL", "1");
  expect(cloudMode()).toBe(true);
  expect(() => supabaseConfiguration()).toThrow("Configure Supabase");
});
it("does not silently use local storage for partial cloud configuration", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  expect(cloudMode()).toBe(true);
  expect(() => supabaseConfiguration()).toThrow("Configure Supabase");
});
it("accepts only this owner's generated audio path", () => {
  const path = `${owner}/339e2554-973d-45d8-bd31-5f26a725fff7.mp3`;
  expect(validateAudioPath(path, owner)).toBe(path);
  for (const invalid of [
    path.replace(owner, "339e2554-973d-45d8-bd31-5f26a725fff7"),
    `${owner}/../audio.mp3`,
    "https://private.example/audio",
    `${owner}/audio.mp3`,
  ]) {
    expect(() => validateAudioPath(invalid, owner)).toThrow();
  }
});
