import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cloudMode, supabaseConfiguration } from "@/lib/supabase/config";
import { ApiError, errorResponse } from "@/lib/http";

export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const connections = ["'self'"];
  const backend = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (backend) {
    try {
      const url = new URL(backend);
      if (url.protocol === "https:" || (isDev && url.protocol === "http:"))
        connections.push(url.origin, url.origin.replace(/^http/, "ws"));
    } catch {
      // Invalid configuration must not expand the browser's allowed origins.
    }
  }
  if (isDev) connections.push("ws:", "wss:");
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connections.join(" ")}`,
    "img-src 'self' blob: data:",
    "media-src 'self' blob: data:",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!isDev && request.nextUrl.protocol === "https:"
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ");
  function next() {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", policy);
    return NextResponse.next({ request: { headers } });
  }
  function secured(response: Response) {
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const cloud = cloudMode();
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const expectedOrigin = new URL(`${request.nextUrl.protocol}//${host}`).origin;
  const site = request.headers.get("sec-fetch-site");
  if (
    !process.env.VERCEL &&
    (origin !== null || site !== null) &&
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(expectedOrigin).hostname,
    )
  )
    return secured(
      errorResponse(
        new ApiError(
          "INVALID_INPUT",
          "Open the local app using localhost or 127.0.0.1.",
          403,
        ),
      ),
    );
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    (site === "cross-site" ||
      site === "same-site" ||
      (origin !== null && origin !== expectedOrigin) ||
      (cloud &&
        !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
        origin === null))
  )
    return secured(
      errorResponse(
        new ApiError(
          "INVALID_INPUT",
          "Open this action from your ConsultNote workspace.",
          403,
        ),
      ),
    );
  if (!cloud) return secured(next());
  let configuration;
  try {
    configuration = supabaseConfiguration();
  } catch {
    return secured(
      request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json(
            {
              error: {
                code: "CONFIGURATION_REQUIRED",
                message: "Complete Supabase setup before using the hosted app.",
              },
            },
            { status: 503 },
          )
        : next(),
    );
  }
  let response = next();
  const client = createServerClient(configuration.url, configuration.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getClaims();
  return secured(response);
}
export const config = {
  matcher: [
    "/",
    "/login",
    "/account",
    "/reset-password",
    "/auth/:path*",
    "/api/:path*",
  ],
};
