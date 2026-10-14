import { expect, test } from "@playwright/test";

test("enforces CSP while keeping the workspace interactive and blocking injected scripts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { policyViolations: string[] }).policyViolations = [];
    window.addEventListener("securitypolicyviolation", (event) => {
      (
        window as unknown as { policyViolations: string[] }
      ).policyViolations.push(event.violatedDirective);
    });
  });
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({
      response,
      body: html.replace(
        "</body>",
        '<script id="injected-test-script">window.__injectedScriptRan = true</script></body>',
      ),
    });
  });
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["permissions-policy"]).toContain("microphone=(self)");
  const policy = headers["content-security-policy"];
  expect(policy).toContain("'strict-dynamic'");
  const nonce = policy.match(/'nonce-([^']+)'/)![1];
  // Development tooling can append trusted scripts after the document loads.
  const scripts = [...(await response!.text()).matchAll(/<script\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => !tag.includes("injected-test-script"));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((tag) => tag.includes(`nonce="${nonce}"`))).toBe(true);
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { policyViolations: string[] }
        ).policyViolations.some((directive) =>
          directive.startsWith("script-src"),
        ),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __injectedScriptRan?: boolean })
          .__injectedScriptRan,
    ),
  ).toBeUndefined();
});

test("rejects cross-origin mutations before parsing and uses a new nonce on reload", async ({
  page,
  request,
}) => {
  const first = await page.goto("/");
  const second = await page.reload();
  expect(second!.headers()["content-security-policy"]).not.toBe(
    first!.headers()["content-security-policy"],
  );
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const response = await request.fetch("/api/consultations", {
      method,
      headers: { origin: "https://evil.example" },
      data: "not JSON",
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.message).toContain(
      "ConsultNote workspace",
    );
  }
});
