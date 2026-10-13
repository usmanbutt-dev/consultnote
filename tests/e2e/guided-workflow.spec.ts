import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { sourceDigest } from "../../src/lib/evidence";
import transcript from "../fixtures/transcript.json" with { type: "json" };
import notes from "../fixtures/notes.json" with { type: "json" };

const audio = fileURLToPath(
  new URL("../fixtures/audio/tone.wav", import.meta.url),
);
const result = {
  transcript,
  model: "controlled-model",
  promptVersion: "transcribe-v1",
};

async function upload(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(audio);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
}

test("guides audio through one action into editable notes and an optional conversation", async ({
  page,
}) => {
  let transcriptions = 0;
  let generations = 0;
  await page.route("**/api/transcribe", (route) => {
    transcriptions++;
    return route.fulfill({ json: result });
  });
  await page.route("**/api/notes", (route) => {
    generations++;
    const input = route.request().postDataJSON();
    return route.fulfill({
      json: {
        notes,
        sourceDigest: sourceDigest(input.transcript, input.assignments),
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByLabel("Consultation title", { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Consultation notes", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Conversation transcript", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Save consultation", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Upload recording", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(audio);
  await expect(
    page.getByRole("button", { name: "Replace audio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload recording", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save consultation", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "View conversation", exact: true })
    .click();
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  expect(transcriptions).toBe(1);
  expect(generations).toBe(1);
});

test("retrying failed notes reuses the completed transcript", async ({
  page,
}) => {
  let transcriptions = 0;
  let generations = 0;
  await page.route("**/api/transcribe", (route) => {
    transcriptions++;
    return route.fulfill({ json: result });
  });
  await page.route("**/api/notes", (route) => {
    generations++;
    if (generations === 1)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "AI_UNAVAILABLE",
            message: "Notes are temporarily unavailable. Please retry.",
          },
        },
      });
    const input = route.request().postDataJSON();
    return route.fulfill({
      json: {
        notes,
        sourceDigest: sourceDigest(input.transcript, input.assignments),
      },
    });
  });
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Notes are temporarily unavailable" }),
  ).toContainText("Notes are temporarily unavailable");
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  expect(transcriptions).toBe(1);
  expect(generations).toBe(2);
});

test("cancelling note preparation keeps the transcript and ignores the cancelled result", async ({
  page,
}) => {
  let finish: (() => void) | undefined;
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: result }),
  );
  await page.route("**/api/notes", async (route) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    const input = route.request().postDataJSON();
    await route
      .fulfill({
        json: {
          notes,
          sourceDigest: sourceDigest(input.transcript, input.assignments),
        },
      })
      .catch(() => {});
  });
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Preparing your notes");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  finish?.();
  await page
    .getByRole("button", { name: "View conversation", exact: true })
    .click();
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("History note 1", { exact: true })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Create notes", exact: true }),
  ).toBeEnabled();
});
