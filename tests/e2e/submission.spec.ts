import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { sourceDigest } from "../../src/lib/evidence";
import { transcriptSchema } from "../../src/lib/consultation";
import rawTranscript from "../fixtures/transcript.json" with { type: "json" };
import notes from "../fixtures/notes.json" with { type: "json" };
test.use({ viewport: { width: 1100, height: 1000 } });
const transcript = transcriptSchema.parse(rawTranscript);
const audio = fileURLToPath(
  new URL("../fixtures/audio/tone.wav", import.meta.url),
);
test.beforeEach(async ({ page }) => {
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({
      json: {
        transcript,
        model: "controlled-model",
        promptVersion: "transcribe-v1",
      },
    }),
  );
  await page.route("**/api/notes", (route) => {
    const input = route.request().postDataJSON();
    return route.fulfill({
      json: {
        notes,
        sourceDigest: sourceDigest(input.transcript, input.assignments),
      },
    });
  });
});
async function transcribe(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(audio);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Transcribe audio", exact: true })
    .click();
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toBeVisible();
}
for (const field of ["History note 1", "Transcript segment 1"]) {
  test(`protects a focused ${field} edit before blur`, async ({
    page,
    request,
  }) => {
    const input = await (await request.get("/api/sample")).json();
    const created = await request.post("/api/consultations", {
      data: { ...input, title: `Pending edit QA ${field} ${Date.now()}` },
    });
    expect(created.status()).toBe(201);
    const record = await created.json();
    try {
      await page.goto("/");
      await page
        .getByRole("button", { name: record.title, exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Export Markdown", exact: true }),
      ).toBeEnabled();
      if (field.startsWith("Transcript"))
        await page
          .getByRole("button", { name: "Transcript", exact: true })
          .click();
      const editor = page.getByLabel(field, { exact: true });
      await editor.fill("Pending wording still being edited.");
      await expect(editor).toBeFocused();
      expect(
        await page.evaluate(() => {
          const event = new Event("beforeunload", { cancelable: true });
          window.dispatchEvent(event);
          return event.defaultPrevented;
        }),
      ).toBe(true);
      await expect(
        page.getByRole("button", { name: "Export Markdown", exact: true }),
      ).toBeDisabled();
      await expect(editor).toHaveValue("Pending wording still being edited.");
    } finally {
      await request.delete(`/api/consultations/${record.id}`);
    }
  });
}
test("preserves older note model and prompt provenance when renaming", async ({
  page,
  request,
}) => {
  const sample = await (await request.get("/api/sample")).json();
  const input = {
    ...sample,
    title: `Provenance QA ${Date.now()}`,
    model:
      "AssemblyAI:previous; Groq:previous-roles | notes:Groq:previous-notes-model",
    promptVersion: "assemblyai-v1/roles-v1 | notes:notes-v2",
  };
  const created = await request.post("/api/consultations", { data: input });
  expect(created.status()).toBe(201);
  const record = await created.json();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: input.title, exact: true }).click();
    await page
      .getByLabel("Consultation title", { exact: true })
      .fill(`${input.title} renamed`);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/consultations/${record.id}`) &&
        response.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: "Save consultation", exact: true })
      .click();
    const updated = await (await saved).json();
    expect(updated.model).toBe(input.model);
    expect(updated.promptVersion).toBe(input.promptVersion);
  } finally {
    await request.delete(`/api/consultations/${record.id}`);
  }
});
test("generates editable evidence-linked notes and confirms before invalidating them", async ({
  page,
}) => {
  await transcribe(page);
  await page
    .getByRole("button", { name: "Generate notes", exact: true })
    .click();
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveValue(
    notes.sections[0].items[0].text,
  );
  await page
    .getByLabel("History note 1", { exact: true })
    .fill("Reviewed headache discussion.");
  await page
    .getByRole("button", { name: "Source segment 2", exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("Transcript segment 2", { exact: true }),
  ).toBeFocused();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByLabel("Transcript segment 2", { exact: true })
    .fill("Changed text.");
  await page.getByLabel("Transcript segment 1", { exact: true }).focus();
  await expect(
    page.getByLabel("Transcript segment 2", { exact: true }),
  ).toHaveValue(transcript.segments[1].text);
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveValue(
    "Reviewed headache discussion.",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("Speaker 1 role", { exact: true })
    .selectOption("unknown");
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Save consultation", exact: true }),
  ).toBeDisabled();
});
test("saves, reopens, renames and exports a consultation through real SQLite routes", async ({
  page,
  request,
}) => {
  const title = `Submission test ${Date.now()}`;
  await transcribe(page);
  await page.getByLabel("Consultation title", { exact: true }).fill(title);
  await page
    .getByRole("button", { name: "Generate notes", exact: true })
    .click();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/consultations") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save consultation", exact: true })
    .click();
  const record = await (await saved).json();
  try {
    await expect(
      page.getByText("All changes saved.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "New consultation", exact: true })
      .click();
    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(
      page.getByLabel("Consultation title", { exact: true }),
    ).toHaveValue(title);
    await expect(page.getByLabel("Audio playback")).toHaveCount(0);
    await page
      .getByLabel("Consultation title", { exact: true })
      .fill(`${title} reviewed`);
    await page
      .getByRole("button", { name: "Save consultation", exact: true })
      .click();
    await expect(
      page.getByText("All changes saved.", { exact: true }),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export Markdown", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
    const stream = await download.createReadStream();
    let markdown = "";
    for await (const chunk of stream!) markdown += chunk.toString();
    expect(markdown).toContain(`${title} reviewed`);
    expect(markdown).toContain("(#segment-2)");
    expect(markdown).toContain(transcript.segments[0].text);
    await page.reload();
    await page
      .getByRole("button", { name: `${title} reviewed`, exact: true })
      .click();
    await expect(
      page.getByLabel("History note 1", { exact: true }),
    ).toBeVisible();
  } finally {
    await request.delete(`/api/consultations/${record.id}`);
  }
});
test("loads a clearly labeled sample without calling an AI API and preserves the label after saving", async ({
  page,
  request,
}) => {
  let providerCalls = 0;
  await page.route("**/api/transcribe", () => {
    providerCalls++;
  });
  await page.route("**/api/notes", () => {
    providerCalls++;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample consultation", exact: true })
    .click();
  await expect(
    page.getByText("Prepared fictional sample", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  expect(providerCalls).toBe(0);
  await page
    .getByLabel("Consultation title", { exact: true })
    .fill(`Prepared sample QA ${Date.now()}`);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/consultations") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save consultation", exact: true })
    .click();
  const record = await (await saved).json();
  try {
    await expect(
      page.getByText("All changes saved.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: record.title, exact: true }).click();
    await expect(
      page.getByText("Prepared fictional sample", { exact: true }),
    ).toBeVisible();
    expect(providerCalls).toBe(0);
  } finally {
    await request.delete(`/api/consultations/${record.id}`);
  }
});
test("keeps notes and the draft after failed regeneration or saving", async ({
  page,
}) => {
  await transcribe(page);
  await page
    .getByRole("button", { name: "Generate notes", exact: true })
    .click();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("History note 1", { exact: true })
    .fill("Keep my reviewed note.");
  await page
    .getByLabel("Consultation title", { exact: true })
    .fill("Kept draft");
  await page.route("**/api/notes", (route) =>
    route.fulfill({
      status: 429,
      json: {
        error: {
          code: "AI_QUOTA_EXCEEDED",
          message: "Groq quota reached. Retry later.",
        },
      },
    }),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Regenerate notes", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Groq quota" }),
  ).toBeVisible();
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveValue(
    "Keep my reviewed note.",
  );
  await page.route("**/api/consultations", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          json: {
            error: {
              code: "STORAGE_FAILED",
              message: "Storage unavailable. Your draft is retained.",
            },
          },
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Save consultation", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Storage unavailable" }),
  ).toBeVisible();
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveValue(
    "Keep my reviewed note.",
  );
});

test("ignores cancelled note generation and retains the reviewed transcript", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let handled!: () => void;
  const done = new Promise<void>((resolve) => {
    handled = resolve;
  });
  await page.route("**/api/notes", async (route) => {
    const input = route.request().postDataJSON();
    await gate;
    try {
      await route.fulfill({
        json: {
          notes,
          sourceDigest: sourceDigest(input.transcript, input.assignments),
        },
      });
    } catch {
      // Cancelling the request can make the controlled response undeliverable.
    } finally {
      handled();
    }
  });
  await transcribe(page);
  await page
    .getByRole("button", { name: "Generate notes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Generating notes…", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel notes", exact: true }).click();
  release();
  await done;
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toHaveValue(transcript.segments[0].text);
});

test("sample notes and evidence navigation work on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample consultation", exact: true })
    .click();
  await expect(
    page.getByText("Prepared fictional sample", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Source segment 2", exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("Transcript segment 2", { exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("mobile-sample.png"),
    fullPage: true,
  });
});

test("cannot replace the draft while a save response is pending", async ({
  page,
  request,
}) => {
  await transcribe(page);
  await page
    .getByRole("button", { name: "Generate notes", exact: true })
    .click();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let recordId: string | undefined;
  await page.route("**/api/consultations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    recordId = (await response.json()).id;
    await gate;
    await route.fulfill({ response });
  });
  let replacements = 0;
  await page.route("**/api/audio/validate", (route) => {
    replacements++;
    return route.continue();
  });
  page.on("dialog", (dialog) => dialog.accept());
  try {
    await page
      .getByRole("button", { name: "Save consultation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Saving…", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Audio file", { exact: true }).setInputFiles({
      name: "replacement.wav",
      mimeType: "audio/wav",
      buffer: await readFile(audio),
    });
    release();
    await expect(
      page.getByText("All changes saved.", { exact: true }),
    ).toBeVisible();
    expect(replacements).toBe(0);
    await expect(
      page.getByLabel("Transcript segment 1", { exact: true }),
    ).toHaveValue(transcript.segments[0].text);
  } finally {
    release();
    if (recordId) await request.delete(`/api/consultations/${recordId}`);
  }
});
