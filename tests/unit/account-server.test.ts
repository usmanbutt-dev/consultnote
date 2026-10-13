import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  removeAccount,
  assertAccountOrigin,
  validateAvatar,
  uploadAvatar,
} from "@/lib/account-server";
import { ApiError } from "@/lib/http";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  signedIn: vi.fn(),
  admin: vi.fn(),
  authenticate: vi.fn(),
  signout: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  requireSignedInUser: mocks.signedIn,
  adminSupabase: mocks.admin,
  requireOwner: mocks.signedIn,
  clearAuthCookies: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
const id = "9d617a5e-8818-4abb-a18a-04afbdce3757";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
  mocks.signedIn.mockResolvedValue({
    userId: id,
    user: { id, email: "doctor@example.test", app_metadata: {} },
    client: { auth: { signOut: mocks.signout } },
  });
  mocks.createClient.mockReturnValue({
    auth: {
      signInWithPassword: mocks.authenticate,
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  });
});
afterEach(() => vi.unstubAllEnvs());

it("rejects foreign and absent origins before privileged mutations", () => {
  expect(() =>
    assertAccountOrigin(
      new Request("http://localhost/api/account", {
        headers: { origin: "https://evil.example" },
      }),
    ),
  ).toThrow();
  expect(() =>
    assertAccountOrigin(new Request("http://localhost/api/account")),
  ).toThrow();
  expect(() =>
    assertAccountOrigin(
      new Request("http://localhost/api/account", {
        headers: { origin: "http://localhost" },
      }),
    ),
  ).not.toThrow();
});

it("requires the current password before any account cleanup", async () => {
  mocks.authenticate.mockResolvedValue({
    data: { user: null },
    error: { code: "invalid_credentials", status: 400 },
  });
  await expect(
    removeAccount({ password: "wrong", confirmation: "DELETE" }),
  ).rejects.toMatchObject({ status: 401 });
  expect(mocks.admin).not.toHaveBeenCalled();
});

it("does not delete Auth or claim success when owned storage cleanup fails", async () => {
  mocks.authenticate.mockResolvedValue({ data: { user: { id } }, error: null });
  const deleted = vi.fn();
  const query = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
    then: (resolve: (x: unknown) => void) => resolve({ error: null }),
  };
  mocks.admin.mockReturnValue({
    from: () => ({ update: () => query }),
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
        deleteUser: deleted,
      },
    },
    storage: {
      from: () => ({
        list: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Storage unavailable"),
        }),
      }),
    },
  });
  await expect(
    removeAccount({ password: "password123", confirmation: "DELETE" }),
  ).rejects.toMatchObject({ status: 503 });
  expect(deleted).not.toHaveBeenCalled();
});

it("rejects oversized photos and SVG regardless of declared content type", async () => {
  await expect(
    validateAvatar(new Uint8Array(2 * 1024 * 1024 + 1)),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    validateAvatar(
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      ),
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(validateAvatar(new Uint8Array())).rejects.toMatchObject({
    status: 400,
  });
});

it("removes only the authenticated owner's files before deleting Auth", async () => {
  mocks.authenticate.mockResolvedValue({ data: { user: { id } }, error: null });
  const events: string[] = [];
  const objects: Record<string, string[]> = {
    "consultation-audio": ["audio.wav"],
    "doctor-avatars": ["photo.png"],
  };
  const query = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
    then: (resolve: (x: unknown) => void) => resolve({ error: null }),
  };
  const deleted = vi.fn(async (userId: string) => {
    events.push(`delete:${userId}`);
    return { error: null };
  });
  mocks.admin.mockReturnValue({
    from: () => ({ update: () => query }),
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
        deleteUser: deleted,
      },
    },
    storage: {
      from: (bucket: string) => ({
        list: vi.fn(async (prefix: string) => {
          expect(prefix).toBe(id);
          return {
            data: objects[bucket].map((name) => ({ name, id: name })),
            error: null,
          };
        }),
        remove: vi.fn(async (paths: string[]) => {
          expect(paths).toEqual(objects[bucket].map((name) => `${id}/${name}`));
          objects[bucket] = [];
          events.push(bucket);
          return { error: null };
        }),
      }),
    },
  });
  mocks.signout.mockResolvedValue({ error: null });
  await removeAccount({ password: "password123", confirmation: "DELETE" });
  expect(events).toEqual([
    "consultation-audio",
    "doctor-avatars",
    `delete:${id}`,
  ]);
  expect(query.eq).toHaveBeenCalledWith("user_id", id);
  expect(deleted).toHaveBeenCalledWith(id);
});

it("treats an unavailable password verifier as a retryable failure", async () => {
  mocks.authenticate.mockResolvedValue({
    data: { user: null },
    error: { code: "unexpected_failure", status: 503 },
  });
  await expect(
    removeAccount({ password: "password123", confirmation: "DELETE" }),
  ).rejects.toMatchObject({ status: 503 });
  expect(mocks.admin).not.toHaveBeenCalled();
});

it("checks server configuration before uploading a photo that cannot be saved", async () => {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        full_name: "Ayesha Khan",
        specialty: "",
        clinic: "",
        avatar_path: null,
        deleting_at: null,
      },
      error: null,
    }),
  };
  mocks.signedIn.mockResolvedValue({
    userId: id,
    user: { id, email: "doctor@example.test" },
    client: { from: () => query, storage: { from: () => ({ upload }) } },
  });
  mocks.admin.mockImplementation(() => {
    throw new ApiError("CONFIGURATION_REQUIRED", "Server key missing", 503);
  });
  const png = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH6kAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  await expect(uploadAvatar(png)).rejects.toMatchObject({ status: 503 });
  expect(upload).not.toHaveBeenCalled();
});
