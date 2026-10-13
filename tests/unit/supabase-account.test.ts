import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as signout } from "@/app/api/auth/signout/route";
import {
  adminSupabase,
  requireOwner,
  clearAuthCookies,
} from "@/lib/supabase/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getUser: vi.fn(),
  removeCookie: vi.fn(),
  signout: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mocks.getUser, signOut: mocks.signout },
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [
      { name: "sb-test-auth-token.0" },
      { name: "sb-test-auth-token-code-verifier" },
      { name: "other-cookie" },
    ],
    delete: mocks.removeCookie,
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret-modern");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-test");
});
afterEach(() => vi.unstubAllEnvs());
it("prefers the modern server key while retaining the legacy fallback", () => {
  adminSupabase();
  expect(mocks.create).toHaveBeenLastCalledWith(
    "https://test.supabase.co",
    "secret-modern",
    expect.any(Object),
  );
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  adminSupabase();
  expect(mocks.create).toHaveBeenLastCalledWith(
    "https://test.supabase.co",
    "legacy-test",
    expect.any(Object),
  );
});
it("blocks new workspace work for an account being removed", async () => {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "owner", app_metadata: { account_deleting: true } } },
    error: null,
  });
  await expect(requireOwner()).rejects.toMatchObject({
    code: "ACCOUNT_DELETING",
    status: 409,
  });
});
it("clears only this project's session and recovery cookies", async () => {
  await clearAuthCookies();
  expect(mocks.removeCookie.mock.calls).toEqual([
    ["sb-test-auth-token.0"],
    ["sb-test-auth-token-code-verifier"],
  ]);
});

it("can sign out this browser when remote session revocation is unavailable", async () => {
  mocks.signout.mockRejectedValue(new Error("Auth unavailable"));
  const response = await signout(
    new Request("http://localhost/api/auth/signout", {
      method: "POST",
      headers: { origin: "http://localhost" },
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.removeCookie.mock.calls).toEqual([
    ["sb-test-auth-token.0"],
    ["sb-test-auth-token-code-verifier"],
  ]);
});
