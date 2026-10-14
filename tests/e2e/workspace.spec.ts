import { expect } from "@playwright/test";
import { test } from "./prepared-consultation";

test("opens the English conversation beside notes without language choices", async ({
  page,
  loadPreparedConsultation,
}) => {
  await page.goto("/");
  await expect(
    page.getByLabel("Recording language", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Notes language", { exact: true })).toHaveCount(
    0,
  );
  await loadPreparedConsultation();
  await page
    .getByRole("button", { name: "View conversation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "History bullet points" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Transcript document" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Source segment 2", exact: true }).first(),
  ).toBeHidden();
  await expect(page.getByText("Sources", { exact: true })).toHaveCount(0);
  const left = await page
    .getByRole("region", { name: "Conversation transcript", exact: true })
    .boundingBox();
  const right = await page
    .getByRole("region", { name: "Consultation notes", exact: true })
    .boundingBox();
  expect(left!.x).toBeGreaterThan(right!.x + right!.width);
  expect(Math.abs(right!.y - left!.y)).toBeLessThan(2);
});

test("opens an honest empty workspace without an AI key", async ({ page }) => {
  await page.route("**/api/consultations", (route) =>
    route.fulfill({ json: { consultations: [] } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "New consultation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No consultations yet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "Try a sample conversation",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save consultation", exact: true }),
  ).toBeHidden();
  await page.screenshot({
    path: test.info().outputPath("desktop.png"),
    fullPage: true,
  });
});

test("starts a fresh consultation after reviewing a sample", async ({
  page,
  loadPreparedConsultation,
}) => {
  await page.goto("/");
  await loadPreparedConsultation();
  await expect(
    page.getByLabel("History note 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New consultation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Consultation title", { exact: true }),
  ).toBeHidden();
});

test("keeps transcript and notes usable on a narrow screen", async ({
  page,
  loadPreparedConsultation,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await loadPreparedConsultation();
  await expect(
    page.getByRole("heading", { name: "Consultation notes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View conversation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Consultation notes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conversation transcript", exact: true }),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("mobile.png"),
    fullPage: true,
  });
});
