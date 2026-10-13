import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";
const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  serverSupabase: async () => ({ auth: { exchangeCodeForSession: exchange } }),
}));
beforeEach(() => {
  exchange.mockReset();
  exchange.mockResolvedValue({ error: null });
});
it.each([
  "https://evil.example",
  "//evil.example",
  "/account",
  "/reset-password?next=evil",
])("does not redirect an authentication callback to %s", async (next) => {
  const response = await GET(
    new Request(
      `http://localhost/auth/callback?code=test&next=${encodeURIComponent(next)}`,
    ),
  );
  expect(response.headers.get("location")).toBe("http://localhost/");
});
it("exchanges recovery codes before opening the password screen", async () => {
  const response = await GET(
    new Request(
      "http://localhost/auth/callback?code=test&next=/reset-password",
    ),
  );
  expect(exchange).toHaveBeenCalledWith("test");
  expect(response.headers.get("location")).toBe(
    "http://localhost/reset-password",
  );
});
it("returns expired or unavailable links to sign in", async () => {
  exchange.mockRejectedValue(new Error("expired"));
  const response = await GET(
    new Request("http://localhost/auth/callback?code=expired"),
  );
  expect(response.headers.get("location")).toBe(
    "http://localhost/login?recovery=expired",
  );
});
