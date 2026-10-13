import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
