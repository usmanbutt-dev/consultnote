import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import fixture from "../fixtures/transcript.json" with { type: "json" };
test.use({ viewport: { width: 1100, height: 1000 } });

const audio = fileURLToPath(
  new URL("../fixtures/audio/tone.wav", import.meta.url),
);
const result = {
  transcript: fixture,
  model: "fictional-test-model",
  promptVersion: "transcribe-v1",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/notes", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "AI_UNAVAILABLE",
          message: "Notes are unavailable for this transcript-only check.",
        },
      },
    }),
  );
});
async function viewConversation(page: Page) {
  await page
    .getByRole("button", { name: "View conversation", exact: true })
    .click();
  await page.getByText("Correct speaker labels", { exact: true }).click();
}
async function upload(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(audio);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
}

test("shows named speakers and suggests a title without overwriting a custom title", async ({
  page,
}) => {
  const named = {
    ...result,
    transcript: {
      ...fixture,
      details: {
        names: [
          {
            speakerId: "speaker-1",
            name: "Dr. Smith",
            segmentIds: ["segment-1"],
          },
          {
            speakerId: "speaker-2",
            name: "Mr. Jones",
            segmentIds: ["segment-1"],
          },
        ],
        concern: { label: "Back pain", segmentIds: ["segment-2"] },
      },
    },
  };
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: named }),
  );
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await viewConversation(page);
  await expect(
    page
      .getByRole("heading", { name: "Doctor · Dr. Smith", exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Patient · Mr. Jones", exact: true })
      .first(),
  ).toBeVisible();
  const title = page.getByLabel("Consultation title", { exact: true });
  await expect(title).toHaveValue(
    /^Mr\. Jones – Back pain – \d{2} [A-Za-z]{3} \d{4}$/,
  );
  await page
    .getByLabel("Transcript segment 1", { exact: true })
    .fill("Greetings. What brings you in?");
  await page.getByLabel("Transcript segment 2", { exact: true }).focus();
  await expect(title).toHaveValue(/^Patient – Back pain –/);
  await page
    .getByLabel("Transcript segment 2", { exact: true })
    .fill("General consultation.");
  await page.getByLabel("Transcript segment 1", { exact: true }).focus();
  await expect(title).toHaveValue(/^Patient – Consultation –/);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Transcribe again", exact: true })
    .click();
  await expect(title).toHaveValue(/^Mr\. Jones – Back pain –/);
  await title.fill("My reviewed consultation");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Transcribe again", exact: true })
    .click();
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toHaveValue(fixture.segments[0].text);
  await expect(title).toHaveValue("My reviewed consultation");
});

test("shows an editable transcript, approximate timestamps and suggested roles", async ({
  page,
}) => {
  const third = structuredClone(result);
  third.transcript.speakers.push({
    id: "speaker-3",
    suggestedRole: "unknown",
    reason: "The third speaker's role is unclear.",
  });
  third.transcript.segments.push({
    id: "segment-5",
    speakerId: "speaker-3",
    startSeconds: 66,
    endSeconds: 70,
    text: "I can help with transport.",
  });
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: third }),
  );
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await viewConversation(page);
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toHaveValue(fixture.segments[0].text);
  await expect(
    page.getByText(fixture.speakers[0].reason, { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Speaker 3 role", { exact: true })).toHaveValue(
    "unknown",
  );
  await page
    .getByLabel("Speaker 1 role", { exact: true })
    .selectOption("patient");
  await expect(page.getByLabel("Speaker 1 role", { exact: true })).toHaveValue(
    "patient",
  );
  await expect(
    page
      .getByRole("heading", { name: "Patient · Speaker 1", exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Patient · Speaker 2", exact: true })
      .first(),
  ).toBeVisible();
  await page
    .getByLabel("Transcript segment 1", { exact: true })
    .fill("The corrected words, including work and transport.");
  await page.getByLabel("Transcript segment 2", { exact: true }).focus();
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toHaveValue("The corrected words, including work and transport.");
  await page.screenshot({
    path: test.info().outputPath("transcript-review.png"),
    fullPage: true,
  });
});

test("quota failure preserves audio and allows exactly one manual retry", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/transcribe", (route) => {
    attempts++;
    return attempts === 1
      ? route.fulfill({
          status: 429,
          json: {
            error: {
              code: "AI_QUOTA_EXCEEDED",
              message: "Gemini quota reached. Wait a moment, then retry.",
            },
          },
        })
      : route.fulfill({ json: result });
  });
  await upload(page);
  const preview = await page.getByLabel("Audio playback").getAttribute("src");
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "quota reached" }),
  ).toContainText("quota reached");
  await expect(page.getByLabel("Audio playback")).toHaveAttribute(
    "src",
    preview!,
  );
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await viewConversation(page);
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

test("blocks duplicate submissions and ignores a response after resetting the draft", async ({
  page,
}) => {
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let finish!: () => void;
  const handled = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/transcribe", async (route) => {
    requests++;
    await gate;
    try {
      await route.fulfill({ json: result });
    } finally {
      finish();
    }
  });
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Reading the conversation" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New consultation", exact: true })
    .click();
  release();
  await handled;
  expect(requests).toBe(1);
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Audio playback")).toHaveCount(0);
});

test("confirms before replacing a reviewed draft or removing its audio", async ({
  page,
}) => {
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: result }),
  );
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await viewConversation(page);
  const segment = page.getByLabel("Transcript segment 1", { exact: true });
  await segment.fill("My reviewed transcript.");
  await page
    .getByLabel("Speaker 1 role", { exact: true })
    .selectOption("unknown");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "New consultation", exact: true })
    .click();
  await expect(segment).toHaveValue("My reviewed transcript.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Remove audio", exact: true }).click();
  await expect(segment).toHaveValue("My reviewed transcript.");
  await expect(page.getByLabel("Audio playback")).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(audio);
  await expect(segment).toHaveValue("My reviewed transcript.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Audio file", { exact: true }).setInputFiles({
    name: "invalid.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("not audio"),
  });
  await expect(
    page.getByRole("region", { name: "Audio recording" }).getByRole("alert"),
  ).toContainText("MP3, WAV, WebM or OGG");
  await expect(segment).toHaveValue("My reviewed transcript.");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "New consultation", exact: true })
    .click();
  await expect(segment).toHaveCount(0);
});

test("keeps prior edits after a failed retranscription and restores invalid empty text", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/transcribe", (route) => {
    attempts++;
    return attempts === 1
      ? route.fulfill({ json: result })
      : route.fulfill({
          status: 504,
          json: {
            error: {
              code: "AI_TIMEOUT",
              message:
                "Gemini took too long. Retry, or use a shorter recording.",
            },
          },
        });
  });
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await viewConversation(page);
  const segment = page.getByLabel("Transcript segment 1", { exact: true });
  await segment.fill("");
  await page.getByLabel("Transcript segment 2", { exact: true }).focus();
  await expect(segment).toHaveValue(fixture.segments[0].text);
  await segment.fill("My reviewed transcript.");
  await page
    .getByLabel("Speaker 1 role", { exact: true })
    .selectOption("unknown");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Transcribe again", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "too long" }),
  ).toBeVisible();
  await expect(segment).toHaveValue("My reviewed transcript.");
  await expect(page.getByLabel("Speaker 1 role", { exact: true })).toHaveValue(
    "unknown",
  );
});

test("renders transcript content as text and works on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const unsafe = structuredClone(result);
  unsafe.transcript.segments[0].text =
    "<script>window.injected = true</script>";
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: unsafe }),
  );
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await viewConversation(page);
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toHaveValue(unsafe.transcript.segments[0].text);
  expect(await page.evaluate(() => "injected" in window)).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("transcript-mobile.png"),
    fullPage: true,
  });
});

test("ignores transcription from audio that has been replaced", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let finish!: () => void;
  const handled = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/transcribe", async (route) => {
    await gate;
    try {
      await route.fulfill({ json: result });
    } finally {
      finish();
    }
  });
  await upload(page);
  const first = await page.getByLabel("Audio playback").getAttribute("src");
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Reading the conversation" }),
  ).toBeVisible();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(audio);
  await expect
    .poll(() => page.getByLabel("Audio playback").getAttribute("src"))
    .not.toBe(first);
  release();
  await handled;
  await expect(
    page.getByLabel("Transcript segment 1", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create notes", exact: true }),
  ).toBeEnabled();
});

test("retrying a failed audio replacement confirms before discarding later transcript edits", async ({
  page,
}) => {
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ json: result }),
  );
  await upload(page);
  let validations = 0;
  await page.route("**/api/audio/validate", (route) => {
    validations++;
    return validations === 1
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "INTERNAL_ERROR",
              message: "Audio inspection is temporarily unavailable.",
            },
          },
        })
      : route.continue();
  });
  await page
    .getByLabel("Audio file", { exact: true })
    .setInputFiles(
      fileURLToPath(new URL("../fixtures/audio/tone.mp3", import.meta.url)),
    );
  await expect(
    page.getByRole("button", { name: "Retry audio check", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await viewConversation(page);
  const segment = page.getByLabel("Transcript segment 1", { exact: true });
  await segment.fill("Reviewed after the failed replacement.");
  await page
    .getByLabel("Speaker 1 role", { exact: true })
    .selectOption("unknown");
  const preview = await page.getByLabel("Audio playback").getAttribute("src");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Retry audio check", exact: true })
    .click();
  await expect(segment).toHaveValue("Reviewed after the failed replacement.");
  await expect(page.getByLabel("Speaker 1 role", { exact: true })).toHaveValue(
    "unknown",
  );
  await expect(page.getByLabel("Audio playback")).toHaveAttribute(
    "src",
    preview!,
  );
  expect(validations).toBe(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Retry audio check", exact: true })
    .click();
  await expect(page.getByText("tone.mp3", { exact: true })).toBeVisible();
  await expect(segment).toHaveCount(0);
  expect(validations).toBe(2);
});

test("missing configuration gives an actionable error and keeps the audio", async ({
  page,
}) => {
  test.skip(
    process.env.EXPECT_MISSING_KEY !== "1",
    "Requires an unconfigured server; never make a live provider request from this suite.",
  );
  await upload(page);
  await page.getByRole("button", { name: "Create notes", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "_API_KEY" }),
  ).toContainText(/Configure (GEMINI|ASSEMBLYAI)_API_KEY/);
  await expect(page.getByLabel("Audio playback")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(
    page.getByRole("button", { name: "Create notes", exact: true }),
  ).toBeEnabled();
});
