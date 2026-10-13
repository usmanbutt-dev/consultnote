import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    browserName: "chromium",
    channel: process.platform === "win32" ? "msedge" : undefined,
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      ASSEMBLYAI_API_KEY: "",
      GROQ_API_KEY: "",
      GEMINI_API_KEY: "",
      DATABASE_PATH: ".superpowers/e2e.sqlite",
    },
    url: "http://127.0.0.1:3100",
    timeout: 120_000,
  },
});
