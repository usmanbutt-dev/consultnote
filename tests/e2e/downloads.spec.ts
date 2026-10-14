import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

test("offers a named PDF and text download after saving reviewed notes", async ({
  page,
  request,
}) => {
  const violations: { directive: string; blocked: string; source: string }[] =
    [];
  page.on("console", (message) => {
    const prefix = "PDF CSP: ";
    if (message.text().startsWith(prefix))
      violations.push(JSON.parse(message.text().slice(prefix.length)));
  });
  await page.addInitScript(() => {
    window.addEventListener("securitypolicyviolation", (event) => {
      console.info(
        `PDF CSP: ${JSON.stringify({ directive: event.violatedDirective, blocked: event.blockedURI, source: event.sourceFile })}`,
      );
    });
  });
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
    ).toBeVisible();
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
    expect(violations).toEqual([]);
    const pdfReady = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "PDF document (.pdf)", exact: true })
      .click();
    const pdf = await pdfReady;
    expect(pdf.suggestedFilename()).toBe(`${title}.pdf`);
    let bytes = Buffer.alloc(0);
    for await (const chunk of (await pdf.createReadStream())!)
      bytes = Buffer.concat([bytes, chunk]);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    // PDF dependencies catch blocked optional constructor probes; generation
    // must still work without weakening the production script policy.
    expect(
      violations.every(
        ({ directive, blocked }) =>
          directive === "script-src" && blocked === "eval",
      ),
    ).toBe(true);
    const loading = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
    });
    const document = await loading.promise;
    try {
      expect((await document.getMetadata()).info).toMatchObject({
        Title: title,
      });
      const content = await (await document.getPage(1)).getTextContent();
      const pdfText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      expect(pdfText).toContain(title);
      expect(pdfText).toContain("Prepared fictional sample");
      expect(pdfText).toContain("History");
      expect(pdfText).toContain(reviewed);
      expect(pdfText).not.toContain(sample.transcript.segments[0].text);
    } finally {
      await loading.destroy();
    }
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
  } finally {
    await request.delete(`/api/consultations/${record.id}`);
  }
});

test("paginates long notes without losing text and numbers every PDF page", async ({
  page,
  request,
}) => {
  const sample = await (await request.get("/api/sample")).json();
  const items = Array.from({ length: 28 }, (_, index) => ({
    text:
      `Reviewed item ${index + 1}. ` +
      "Symptoms, treatment preferences and practical barriers were discussed during this fictional consultation. ".repeat(
        5,
      ) +
      `End of item ${index + 1}.`,
    segmentIds: ["segment-2"],
  }));
  const title = `Long notes QA ${Date.now()}`;
  const created = await request.post("/api/consultations", {
    data: {
      ...sample,
      title,
      notesResult: {
        ...sample.notesResult,
        notes: { sections: [{ kind: "discussion", items }] },
      },
    },
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
      .getByRole("button", { name: "PDF document (.pdf)", exact: true })
      .click();
    const download = await ready;
    let bytes = Buffer.alloc(0);
    for await (const chunk of (await download.createReadStream())!)
      bytes = Buffer.concat([bytes, chunk]);
    const loading = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
    });
    try {
      const pdf = await loading.promise;
      expect(pdf.numPages).toBeGreaterThan(1);
      let text = "";
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        expect(pageText).toContain(`${number} / ${pdf.numPages}`);
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          expect(item.transform[5]).toBeGreaterThan(0);
          expect(item.transform[5]).toBeLessThan(page.view[3]);
        }
        text +=
          " " +
          content.items
            .filter((item) => "str" in item && item.transform[5] > 58)
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ");
      }
      text = text.replace(/\s+/g, " ");
      for (let number = 1; number <= 28; number++) {
        expect(text).toContain(items[number - 1].text);
      }
    } finally {
      await loading.destroy();
    }
  } finally {
    await request.delete(`/api/consultations/${record.id}`);
  }
});

test("offers text instead of silently losing unsupported characters in a PDF", async ({
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
    await page
      .getByRole("button", { name: "PDF document (.pdf)", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "PDF font" }),
    ).toContainText("Plain text or Markdown");
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
