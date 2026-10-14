import { expect, test } from "@playwright/test";

test("offers only named text and Markdown downloads after saving reviewed notes", async ({
  page,
  request,
}) => {
  const sample = await (await request.get("/api/sample")).json();
  const title = "Mr. Jones – Back pain – 14 Oct 2026";
  const created = await request.post("/api/consultations", {
    data: { ...sample, title },
  });
  expect(created.status()).toBe(201);
  const record = await created.json();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: title, exact: true }).click();
    const reviewed =
      "Reviewed wording: discussed café visits – no new symptoms.";
    await page.getByLabel("History note 1", { exact: true }).fill(reviewed);
    await page.getByLabel("Consultation title", { exact: true }).focus();
    await expect(
      page.getByRole("button", { name: "Download notes", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Save consultation", exact: true })
      .click();
    await expect(
      page.getByText("All changes saved.", { exact: true }),
    ).toBeVisible();
    sample.notesResult.notes.sections[0].items[0].text = reviewed;
    await page
      .getByRole("button", { name: "Download notes", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "PDF document (.pdf)", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Plain text (.txt)", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Markdown (.md)", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Download format" }),
    ).not.toBeVisible();
    await page
      .getByRole("button", { name: "Download notes", exact: true })
      .click();
    const textReady = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Plain text (.txt)", exact: true })
      .click();
    const textFile = await textReady;
    expect(textFile.suggestedFilename()).toBe(`${title}.txt`);
    let text = "";
    for await (const chunk of (await textFile.createReadStream())!)
      text += chunk.toString();
    expect(text).toContain(title);
    expect(text).toContain("Prepared fictional sample");
    for (const section of sample.notesResult.notes.sections)
      for (const item of section.items) expect(text).toContain(item.text);
    expect(text).not.toContain("(#segment-");
    expect(text).not.toContain(sample.transcript.segments[0].text);
    await page
      .getByRole("button", { name: "Download notes", exact: true })
      .click();
    const markdownReady = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Markdown (.md)", exact: true })
      .click();
    const markdownFile = await markdownReady;
    expect(markdownFile.suggestedFilename()).toBe(title + ".md");
    let markdown = "";
    for await (const chunk of (await markdownFile.createReadStream())!)
      markdown += chunk.toString();
    expect(markdown).toContain(title);
    expect(markdown).toContain(reviewed);
    expect(markdown).toContain(sample.transcript.segments[0].text);
    expect(markdown).toContain("(#segment-");
  } finally {
    await request.delete(`/api/consultations/${record.id}`);
  }
});

test("preserves Unicode titles in text downloads", async ({
  page,
  request,
}) => {
  const sample = await (await request.get("/api/sample")).json();
  const title = "مریض – Follow-up";
  const created = await request.post("/api/consultations", {
    data: { ...sample, title },
  });
  expect(created.status()).toBe(201);
  const record = await created.json();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: title, exact: true }).click();
    await page
      .getByRole("button", { name: "Download notes", exact: true })
      .click();
    const ready = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Plain text (.txt)", exact: true })
      .click();
    const downloaded = await ready;
    expect(downloaded.suggestedFilename()).toBe(`${title}.txt`);
    let text = "";
    for await (const chunk of (await downloaded.createReadStream())!)
      text += chunk.toString();
    expect(text).toContain(title);
  } finally {
    await request.delete(`/api/consultations/${record.id}`);
  }
});
