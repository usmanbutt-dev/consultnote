import { expect } from "@playwright/test";
import { test } from "./prepared-consultation";

test("replaces help with an account menu without inventing a signed-in doctor", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Help", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).not.toBeVisible();
});

test("keeps speaker correction optional while preserving notes invalidation", async ({
  page,
  loadPreparedConsultation,
}) => {
  await page.goto("/");
  await loadPreparedConsultation();
  await page
    .getByRole("button", { name: "View conversation", exact: true })
    .click();
  await expect(
    page.getByLabel("Speaker 1 role", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Doctor", exact: true }).first(),
  ).toBeVisible();
  await page.getByText("Correct speaker labels", { exact: true }).click();
  await page
    .getByLabel("Speaker 1 role", { exact: true })
    .selectOption("unknown");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Update conversation", exact: true })
    .click();
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Speaker 1", exact: true }).first(),
  ).toBeVisible();
});

test("browser Back protects a draft after returning from an account page", async ({
  page,
  loadPreparedConsultation,
}) => {
  await page.goto("/account");
  await page
    .getByRole("link", { name: "Back to consultations", exact: true })
    .click();
  await loadPreparedConsultation();
  await page
    .getByLabel("History note 1", { exact: true })
    .fill("Unsaved wording that must survive Back.");
  const prompt = page.waitForEvent("dialog");
  await page.evaluate(() => window.history.back());
  const dialog = await prompt;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await expect(page.getByLabel("History note 1", { exact: true })).toHaveValue(
    "Unsaved wording that must survive Back.",
  );
});
