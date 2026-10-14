import { expect } from "@playwright/test";
import { test } from "./prepared-consultation";

test("custom discard dialog protects edits, isolates page focus and supports Escape", async ({
  page,
  loadPreparedConsultation,
}) => {
  await page.goto("/");
  await loadPreparedConsultation();
  const note = page.getByLabel("History note 1", { exact: true });
  await note.fill("My unsaved clinical wording.");
  const trigger = page.getByRole("button", {
    name: "New consultation",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Discard this consultation?",
  });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("discard-dialog-desktop.png"),
  });
  const cancel = dialog.getByRole("button", {
    name: "Keep editing",
    exact: true,
  });
  await expect(cancel).toBeFocused();
  await page
    .locator("aside button")
    .first()
    .evaluate((button: HTMLButtonElement) => button.focus());
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Discard changes", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(note).toHaveValue("My unsaved clinical wording.");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeVisible();
  await expect(note).toHaveCount(0);
});

test("custom delete dialog cancels safely and deletes only after confirmation", async ({
  page,
  loadPreparedConsultation,
}) => {
  await page.goto("/");
  await loadPreparedConsultation();
  const selected = page.locator('aside button[aria-current="true"]');
  const title = await selected.getAttribute("aria-label");
  const remove = page.getByRole("button", {
    name: `Delete ${title}`,
    exact: true,
  });
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Delete consultation?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(selected).toBeVisible();
  await remove.click();
  await dialog
    .getByRole("button", { name: "Delete consultation", exact: true })
    .click();
  await expect(remove).toHaveCount(0);
});

test("account navigation uses a custom dialog without bypassing draft protection", async ({
  page,
  loadPreparedConsultation,
}) => {
  await page.goto("/");
  await loadPreparedConsultation();
  const note = page.getByLabel("History note 1", { exact: true });
  await note.fill("Keep this draft when navigation is cancelled.");
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Leave this consultation?" });
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath("leave-dialog-mobile.png"),
  });
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(note).toHaveValue(
    "Keep this draft when navigation is cancelled.",
  );
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Leave consultation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});
