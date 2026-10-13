import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cloudMode, supabaseConfiguration } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  if (!cloudMode()) return NextResponse.next();
  let configuration;
  try {
    configuration = supabaseConfiguration();
  } catch {
    return request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json(
          {
            error: {
              code: "CONFIGURATION_REQUIRED",
              message: "Complete Supabase setup before using the hosted app.",
            },
          },
          { status: 503 },
        )
      : NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const client = createServerClient(configuration.url, configuration.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
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
