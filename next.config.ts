import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
          },
        ],
      },
    ];
  },
  devIndicators: false,
  experimental: { proxyClientMaxBodySize: 12 * 1024 * 1024 },
  serverExternalPackages: ["ffprobe-static"],
  outputFileTracingIncludes: {
    "/api/audio/validate": [
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
    ],
    "/api/transcribe": ["./node_modules/ffprobe-static/bin/linux/x64/ffprobe"],
    "/api/transcribe/jobs": [
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
    ],
  },
  outputFileTracingExcludes: {
    "/*": [
      "./node_modules/ffprobe-static/bin/darwin/**",
      "./node_modules/ffprobe-static/bin/win32/**",
      "./node_modules/ffprobe-static/bin/linux/arm*/**",
      "./node_modules/ffprobe-static/bin/linux/ia32/**",
    ],
  },
};

export default nextConfig;
