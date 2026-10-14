import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import nextConfig from "../../next.config";
import { proxy } from "@/proxy";
import { createServerClient } from "@supabase/ssr";

const auth = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth })),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  auth.getClaims.mockResolvedValue({ data: null, error: null });
});
afterEach(() => vi.unstubAllEnvs());

it("sets browser protection headers on every route", async () => {
  const rules = await nextConfig.headers?.();
  const headers = Object.fromEntries(
    rules
      ?.find((rule) => rule.source === "/:path*")
      ?.headers.map((header) => [header.key, header.value]) ?? [],
  );
  expect(headers["X-Frame-Options"]).toBe("DENY");
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  expect(headers["Referrer-Policy"]).toBe("no-referrer");
  expect(headers["Permissions-Policy"]).toContain("microphone=(self)");
});

it("uses fresh script nonces and overwrites forged CSP request headers", async () => {
  const request = () =>
    new NextRequest("https://consultnote.test/", {
      headers: {
        "x-nonce": "attacker",
        "Content-Security-Policy": "script-src 'unsafe-inline'",
      },
    });
  const first = await proxy(request());
  const second = await proxy(request());
  const policy = first.headers.get("Content-Security-Policy")!;
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain("attacker");
  expect(
    policy.split(";").find((rule) => rule.trim().startsWith("script-src")),
  ).not.toMatch(/unsafe-inline|unsafe-eval/);
  expect(
    first.headers.get("x-middleware-request-content-security-policy"),
  ).toBe(policy);
  expect(first.headers.get("Cache-Control")).toContain("no-store");
  expect(second.headers.get("Content-Security-Policy")).not.toBe(policy);
});

it.each([
  "https://evil.test",
  "https://consultnote.test.evil.test",
  "null",
  undefined,
])(
  "rejects unsafe cloud requests from %s before any session lookup",
  async (origin) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const response = await proxy(
        new NextRequest("https://consultnote.test/api/consultations", {
          method,
          headers: origin ? { origin } : {},
        }),
      );
      expect(response.status).toBe(403);
    }
    expect(auth.getClaims).not.toHaveBeenCalled();
  },
);

it("allows same-origin cloud mutations and restricts connections to the configured Supabase project", async () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  const response = await proxy(
    new NextRequest("https://consultnote.test/api/notes", {
      method: "POST",
      headers: { origin: "https://consultnote.test" },
    }),
  );
  expect(response.status).toBe(200);
  expect(auth.getClaims).toHaveBeenCalledOnce();
  const policy = response.headers.get("Content-Security-Policy")!;
  expect(policy).toContain(
    "connect-src 'self' https://project.supabase.co wss://project.supabase.co",
  );
  expect(policy).not.toContain("*.supabase.co");
});

it("blocks cross-origin local browser mutations while preserving local CLI requests", async () => {
  const blocked = await proxy(
    new NextRequest("http://127.0.0.1:3000/api/notes", {
      method: "POST",
      headers: { origin: "https://evil.test" },
    }),
  );
  expect(blocked.status).toBe(403);
  const allowed = await proxy(
    new NextRequest("http://127.0.0.1:3000/api/notes", { method: "POST" }),
  );
  expect(allowed.status).toBe(200);
});

it("matches the actual loopback Host header instead of Next's normalized localhost URL", async () => {
  const response = await proxy(
    new NextRequest("http://127.0.0.1:3000/api/notes", {
      method: "POST",
      headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    }),
  );
  expect(response.status).toBe(200);
});

it.each(["cross-site", "same-site"])(
  "blocks %s browser API reads because job polling can finalize work",
  async (site) => {
    const response = await proxy(
      new NextRequest("https://consultnote.test/api/transcribe/jobs/test", {
        headers: { "sec-fetch-site": site },
      }),
    );
    expect(response.status).toBe(403);
  },
);

it("rejects local DNS rebinding even when the browser Origin matches an attacker Host", async () => {
  const response = await proxy(
    new NextRequest("http://rebind.example:3000/api/notes", {
      method: "POST",
      headers: {
        host: "rebind.example:3000",
        origin: "http://rebind.example:3000",
        "sec-fetch-site": "same-origin",
      },
    }),
  );
  expect(response.status).toBe(403);
});

it("preserves refreshed cookies in both the response and forwarded request under CSP", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  auth.getClaims.mockImplementation(async () => {
    const options = vi.mocked(createServerClient).mock.calls.at(-1)![2];
    options.cookies.setAll!(
      [
        {
          name: "sb-test-auth-token",
          value: "refreshed-test-session",
          options: { httpOnly: true, secure: true },
        },
      ],
      {},
    );
    return { data: null, error: null };
  });
  const response = await proxy(new NextRequest("https://consultnote.test/"));
  expect(response.headers.get("set-cookie")).toContain(
    "refreshed-test-session",
  );
  expect(response.headers.get("x-middleware-request-cookie")).toContain(
    "refreshed-test-session",
  );
  expect(response.headers.get("Content-Security-Policy")).toContain(
    "'strict-dynamic'",
  );
});
