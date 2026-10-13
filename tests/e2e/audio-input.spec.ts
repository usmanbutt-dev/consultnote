import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(
  new URL("../fixtures/audio/tone.wav", import.meta.url),
);
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test("uploads, validates, plays and resets audio", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(fixture);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
  await expect(page.getByText("tone.wav", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Audio playback")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page
    .getByLabel("Audio playback")
    .evaluate(async (audio: HTMLAudioElement) => {
      await audio.play();
    });
  await expect
    .poll(() =>
      page
        .getByLabel("Audio playback")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: test.info().outputPath("audio-ready.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Remove audio", exact: true }).click();
  await expect(page.getByLabel("Audio playback")).toHaveCount(0);
});

test("preserves valid audio after a bad replacement and revokes replaced previews", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const revoke = URL.revokeObjectURL;
    (window as unknown as { revoked: string[] }).revoked = [];
    URL.revokeObjectURL = (url) => {
      (window as unknown as { revoked: string[] }).revoked.push(url);
      revoke(url);
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  const input = page.getByLabel("Audio file", { exact: true });
  await input.setInputFiles(fixture);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
  const first = await page.getByLabel("Audio playback").getAttribute("src");
  await input.setInputFiles({
    name: "fake.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("not audio"),
  });
  await expect(
    page.getByRole("region", { name: "Audio recording" }).getByRole("alert"),
  ).toContainText("MP3, WAV, WebM or OGG");
  await expect(page.getByLabel("Audio playback")).toHaveAttribute(
    "src",
    first!,
  );
  await input.setInputFiles(fixture);
  await expect(
    page.getByRole("region", { name: "Audio recording" }).getByRole("alert"),
  ).toHaveCount(0);
  await expect
    .poll(() => page.getByLabel("Audio playback").getAttribute("src"))
    .not.toBe(first);
  expect(
    await page.evaluate(
      () => (window as unknown as { revoked: string[] }).revoked,
    ),
  ).toContain(first);
  const second = await page.getByLabel("Audio playback").getAttribute("src");
  await page
    .getByRole("button", { name: "New consultation", exact: true })
    .click();
  await expect(page.getByLabel("Audio playback")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { revoked: string[] }).revoked,
    ),
  ).toContain(second);
});

test("records actual MediaRecorder WebM and releases microphone tracks", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      (window as unknown as { audioStream: MediaStream }).audioStream = stream;
      return stream;
    };
  });
  const history = page.waitForResponse("**/api/consultations");
  await page.goto("/");
  await history;
  const validation = page.waitForResponse("**/api/audio/validate");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.getByText("Recording", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel("Recording duration")).toContainText("00:01");
  await expect
    .poll(() =>
      page
        .getByRole("meter", { name: "Microphone input level" })
        .evaluate((meter: HTMLMeterElement) => meter.value),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  const response = await validation;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ mimeType: "audio/webm" });
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { audioStream: MediaStream }).audioStream
        .getTracks()
        .every((track) => track.readyState === "ended"),
    ),
  ).toBe(true);
});

test("denied microphone leaves file upload available", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  const history = page.waitForResponse("**/api/consultations");
  await page.goto("/");
  await history;
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Audio recording" }).getByRole("alert"),
  ).toContainText("Allow microphone access");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(fixture);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
});

test("unsupported recording leaves file upload available", async ({ page }) => {
  await page.addInitScript(() => {
    MediaRecorder.isTypeSupported = () => false;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Audio recording" }).getByRole("alert"),
  ).toContainText("Upload a recording");
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(fixture);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
});

test("reset releases an active microphone", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      (window as unknown as { audioStream: MediaStream }).audioStream = stream;
      return stream;
    };
  });
  const history = page.waitForResponse("**/api/consultations");
  await page.goto("/");
  await history;
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.getByText("Recording", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole("button", { name: "New consultation", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      (window as unknown as { audioStream: MediaStream }).audioStream
        .getTracks()
        .every((track) => track.readyState === "ended"),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Audio playback")).toHaveCount(0);
});

test("server rejects an oversized upload before audio processing", async ({
  request,
}) => {
  const response = await request.post("/api/audio/validate", {
    multipart: {
      audio: {
        name: "huge.wav",
        mimeType: "audio/wav",
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
      },
    },
  });
  expect(response.status()).toBe(413);
  expect(await response.json()).toMatchObject({
    error: { code: "AUDIO_TOO_LARGE" },
  });
});

test("automatically stops with headroom for timer delay and encoded packet overhead", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const start = MediaRecorder.prototype.start;
    MediaRecorder.prototype.start = function (timeslice?: number) {
      (window as unknown as { recordingStarted: number }).recordingStarted =
        performance.now();
      return start.call(this, timeslice);
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.getByText("Recording", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Recording duration")).toContainText("00:01");
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 50));
  // Deliver the next timer almost a second late, while staying below 600s.
  const elapsed = await page.evaluate(
    () =>
      performance.now() -
      (window as unknown as { recordingStarted: number }).recordingStarted,
  );
  await page.clock.fastForward(599_800 - elapsed);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toHaveCount(0);
});

test("cancel releases a microphone that arrives after permission was requested", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      (window as unknown as { lateStream: MediaStream }).lateStream = stream;
      return new Promise<MediaStream>((resolve) => {
        (
          window as unknown as { resolveMicrophone: () => void }
        ).resolveMicrophone = () => resolve(stream);
      });
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!(window as unknown as { resolveMicrophone?: () => void })
            .resolveMicrophone,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() =>
    (
      window as unknown as { resolveMicrophone: () => void }
    ).resolveMicrophone(),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { lateStream: MediaStream }).lateStream
          .getTracks()
          .every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
});

test("cancel ignores an in-flight validation response", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let finished!: () => void;
  const handled = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route("**/api/audio/validate", async (route) => {
    await gate;
    await route.fulfill({
      json: { mimeType: "audio/wav", durationSeconds: 1, sizeBytes: 8044 },
    });
    finished();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await page.getByLabel("Audio file", { exact: true }).setInputFiles(fixture);
  await expect(
    page.getByText("Checking audio…", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  await handled;
  await expect(
    page.getByRole("button", { name: "Upload recording", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Audio playback")).toHaveCount(0);
  await expect(page.getByText("Audio ready", { exact: true })).toHaveCount(0);
});

test("keeps a captured recording for retry when audio validation fails", async ({
  page,
}) => {
  let checks = 0;
  await page.route("**/api/audio/validate", async (route) => {
    checks++;
    if (checks === 1) {
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "INTERNAL_ERROR",
            message: "Audio inspection is temporarily unavailable.",
          },
        },
      });
    } else await route.continue();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.getByLabel("Recording duration")).toContainText("00:01");
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Audio recording" }).getByRole("alert"),
  ).toContainText("temporarily unavailable");
  await page
    .getByRole("button", { name: "Upload recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry audio check", exact: true }),
  ).toBeVisible();
  const validation = page.waitForResponse("**/api/audio/validate");
  await page
    .getByRole("button", { name: "Retry audio check", exact: true })
    .click();
  expect((await validation).ok()).toBe(true);
  await expect(page.getByText("Audio ready", { exact: true })).toBeVisible();
  await expect(page.getByText("recording.webm", { exact: true })).toBeVisible();
  expect(checks).toBe(2);
});
