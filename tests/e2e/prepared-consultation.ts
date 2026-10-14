import { test as base, expect } from "@playwright/test";

export const test = base.extend<{
  loadPreparedConsultation: () => Promise<void>;
}>({
  loadPreparedConsultation: async ({ page, request }, runFixture) => {
    const ids: string[] = [];
    try {
      await runFixture(async () => {
        const input = await (await request.get("/api/sample")).json();
        input.title = `Prepared consultation QA ${crypto.randomUUID()}`;
        const response = await request.post("/api/consultations", {
          data: input,
        });
        expect(response.status()).toBe(201);
        const record = await response.json();
        ids.push(record.id);
        await page.reload();
        if ((page.viewportSize()?.width ?? 1440) < 1024)
          await page.getByText("Saved consultations", { exact: true }).click();
        await page
          .getByRole("button", { name: record.title, exact: true })
          .click();
        await expect(
          page.getByLabel("History note 1", { exact: true }),
        ).toBeVisible();
      });
    } finally {
      for (const id of ids) await request.delete(`/api/consultations/${id}`);
    }
  },
});
