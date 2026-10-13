import { expect, test } from "@playwright/test";

test("opens an honest empty workspace without an AI key", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "New consultation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No consultations yet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Transcription, notes and saving are not available in this preview yet.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Save consultation", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: test.info().outputPath("desktop.png"),
    fullPage: true,
  });
});

test("switches input methods and starts a fresh consultation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Upload recording", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Choose audio file", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "New consultation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Record audio", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("keeps transcript and notes usable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
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
