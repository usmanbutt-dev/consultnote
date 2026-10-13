import { expect, test, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";
import { sourceDigest } from "../../src/lib/evidence";
import { transcriptSchema } from "../../src/lib/consultation";
import rawTranscript from "../fixtures/transcript.json" with { type: "json" };
import rawNotes from "../fixtures/notes.json" with { type: "json" };
const transcript = transcriptSchema.parse(rawTranscript);
const completed = {
  status: "completed",
  result: {
    transcript,
    model: "controlled-assembly",
    promptVersion: "assemblyai-v1",
  },
};
let server: ViteDevServer;
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const sdk = fileURLToPath(
    new URL("../fixtures/cloud-harness/supabase.ts", import.meta.url),
  );
  server = await createServer({
    root,
    configFile: false,
    envFile: false,
    logLevel: "error",
    resolve: { alias: { "@": `${root}/src` } },
    server: { host: "127.0.0.1", port: 3202, strictPort: true },
    plugins: [
      {
        name: "controlled-supabase",
        enforce: "pre",
        resolveId(source) {
          if (
            source === "./supabase/browser" ||
            source === "@/lib/supabase/browser" ||
            source.replaceAll("\\", "/").endsWith("/src/lib/supabase/browser")
          )
            return sdk;
        },
      },
    ],
  });
  await server.listen();
});
test.afterAll(async () => {
  await server?.close();
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/consultations", (route) =>
    route.fulfill({ json: { consultations: [] } }),
  );
  await page.route("**/api/audio/validate", (route) => {
    const input = route.request().postDataJSON();
    expect(typeof input.path).toBe("string");
    expect(route.request().postData()!.length).toBeLessThan(200);
    return route.fulfill({
      json: { mimeType: "audio/mpeg", durationSeconds: 90 },
    });
  });
  await page.route("**/api/transcribe/jobs/*", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({ status: 204 })
      : route.fulfill({ json: completed }),
  );
});
async function upload(page: Page) {
  await page.goto(
    "http://127.0.0.1:3202/tests/fixtures/cloud-harness/index.html",
  );
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles({
    name: "large.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.alloc(7 * 1024 * 1024),
  });
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
}
test("cloud workspace uploads large audio directly and requests English notes with automatic language detection", async ({
  page,
}) => {
  let starts = 0;
  await page.route("**/api/transcribe/jobs", (route) => {
    starts++;
    expect(route.request().postDataJSON().language).toBe("auto");
    expect(route.request().postData()!.length).toBeLessThan(400);
    return route.fulfill({ status: 202, json: { status: "processing" } });
  });
  await page.route("**/api/notes", (route) => {
    const input = route.request().postDataJSON();
    expect(input.notesLanguage).toBe("en");
    const notes = structuredClone(rawNotes);
    notes.sections[0].items[0].text = "Patient reports a headache.";
    return route.fulfill({
      json: {
        notes,
        sourceDigest: sourceDigest(input.transcript, input.assignments),
      },
    });
  });
  await upload(page);
  await page
    .getByRole("button", { name: "Transcribe audio", exact: true })
    .click();
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate notes", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Generate notes", exact: true })
    .click();
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveValue(
    "Patient reports a headache.",
  );
  expect(await page.evaluate(() => window.cloudUploads[0].bytes)).toBe(
    7 * 1024 * 1024,
  );
  expect(starts).toBe(1);
});
for (const failure of ["connection", "gateway"] as const) {
  test(`retries a ${failure} failure with the same job ID`, async ({
    page,
  }) => {
    const ids: string[] = [];
    await page.route("**/api/transcribe/jobs", (route) => {
      ids.push(route.request().postDataJSON().id);
      if (ids.length === 1)
        return failure === "connection"
          ? route.abort("failed")
          : route.fulfill({
              status: 504,
              json: { error: { message: "Gateway timeout." } },
            });
      return route.fulfill({ status: 202, json: { status: "processing" } });
    });
    await upload(page);
    await page
      .getByRole("button", { name: "Transcribe audio", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      failure === "connection" ? "connection" : "Gateway timeout",
    );
    await page
      .getByRole("button", { name: "Transcribe audio", exact: true })
      .click();
    await expect(
      page.getByLabel("Transcript segment 1", { exact: true }),
    ).toBeVisible();
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });
}

for (const replacement of ["invalid upload", "cancelled recording"] as const) {
  test(`retains a pending transcription after ${replacement}`, async ({
    page,
  }) => {
    const ids: string[] = [];
    let deletions = 0;
    let finish = false;
    await page.route("**/api/transcribe/jobs", (route) => {
      ids.push(route.request().postDataJSON().id);
      return route.fulfill({ status: 202, json: { status: "processing" } });
    });
    await page.route("**/api/transcribe/jobs/*", (route) => {
      if (route.request().method() === "DELETE") {
        deletions++;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        json: finish ? completed : { status: "processing" },
      });
    });
    if (replacement === "cancelled recording")
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
      });
    await upload(page);
    await page
      .getByRole("button", { name: "Transcribe audio", exact: true })
      .click();
    await expect.poll(() => ids.length).toBe(1);
    await page
      .getByRole("button", { name: "Cancel transcription", exact: true })
      .click();
    if (replacement === "invalid upload") {
      await page.route("**/api/audio/validate", (route) =>
        route.fulfill({
          status: 400,
          json: {
            error: { message: "The replacement audio could not be read." },
          },
        }),
      );
      await page.getByLabel("Audio file", { exact: true }).setInputFiles({
        name: "invalid.mp3",
        mimeType: "audio/mpeg",
        buffer: Buffer.alloc(100),
      });
      await expect(page.getByRole("alert")).toContainText("replacement audio");
    } else {
      await page
        .getByRole("button", { name: "Record audio", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Start recording", exact: true })
        .click();
      await expect(
        page.getByText("Opening microphone…", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    await expect(page.getByText("large.mp3", { exact: true })).toBeVisible();
    expect(deletions).toBe(0);
    finish = true;
    await page
      .getByRole("button", { name: "Transcribe audio", exact: true })
      .click();
    await expect(
      page.getByLabel("Transcript segment 1", { exact: true }),
    ).toBeVisible();
    expect(ids).toHaveLength(1);
  });
}

test("starts fresh on the first retry after a terminal submission failure", async ({
  page,
}) => {
  const ids: string[] = [];
  await page.route("**/api/transcribe/jobs", (route) => {
    ids.push(route.request().postDataJSON().id);
    return ids.length === 1
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "AI_UNAVAILABLE",
              message: "The transcription service is temporarily unavailable.",
            },
          },
        })
      : route.fulfill({ status: 202, json: { status: "processing" } });
  });
  await page.route("**/api/transcribe/jobs/*", (route) =>
    route.fulfill({
      json: route.request().url().endsWith(ids[0])
        ? {
            status: "failed",
            failure: {
              message: "The transcription service is temporarily unavailable.",
            },
          }
        : completed,
    }),
  );
  await upload(page);
  await page
    .getByRole("button", { name: "Transcribe audio", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page
    .getByRole("button", { name: "Transcribe audio", exact: true })
    .click();
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[1]).not.toBe(ids[0]);
});
