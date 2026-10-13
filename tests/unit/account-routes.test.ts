import { beforeEach, expect, it, vi } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/account/route";
import { POST as upload } from "@/app/api/account/avatar/route";
import { ApiError } from "@/lib/http";

vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ owner: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  requireOwner: auth.owner,
  requireSignedInUser: auth.owner,
  adminSupabase: auth.admin,
}));
beforeEach(() => {
  vi.resetAllMocks();
  auth.owner.mockRejectedValue(
    new ApiError("UNAUTHORIZED", "Sign in again.", 401),
  );
});
const request = (method: string, body: unknown, origin = "http://localhost") =>
  new Request("http://localhost/api/account", {
    method,
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

it("rejects anonymous account reads and updates without privileged access", async () => {
  expect((await GET()).status).toBe(401);
  expect((await PATCH(request("PATCH", {}))).status).toBe(401);
  expect(auth.admin).not.toHaveBeenCalled();
});
it("rejects cross-origin deletion and uploads before authentication or storage", async () => {
  expect(
    (await DELETE(request("DELETE", {}, "https://evil.example"))).status,
  ).toBe(403);
  expect(
    (await upload(request("POST", {}, "https://evil.example"))).status,
  ).toBe(403);
  expect(auth.owner).not.toHaveBeenCalled();
  expect(auth.admin).not.toHaveBeenCalled();
});
it("updates only the authenticated profile and rejects a supplied target ID", async () => {
  const id = "9d617a5e-8818-4abb-a18a-04afbdce3757";
  const eq = vi.fn().mockReturnThis();
  const query = {
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq,
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id,
        full_name: "Ayesha Malik",
        specialty: "Family medicine",
        clinic: "Clinic A",
        avatar_path: null,
        deleting_at: null,
      },
      error: null,
    }),
  };
  auth.owner.mockResolvedValue({
    userId: id,
    user: { id, email: "doctor@example.test" },
    client: { from: () => query },
  });
  const fields = {
    fullName: "Ayesha Malik",
    specialty: "Family medicine",
    clinic: "Clinic A",
  };
  const result = await PATCH(request("PATCH", fields));
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ id, ...fields });
  expect(
    eq.mock.calls.every(([column, value]) => column === "id" && value === id),
  ).toBe(true);
  query.update.mockClear();
  expect(
    (await PATCH(request("PATCH", { ...fields, id: "someone-else" }))).status,
  ).toBe(400);
  expect(query.update).not.toHaveBeenCalled();
});
