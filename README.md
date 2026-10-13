# ConsultNote

AI-assisted notes for doctor-patient conversations, with a source transcript and human review.

**Status:** Milestones 1–3 implemented: audio capture, Gemini transcription and speaker review. The first live check accepted the configured key but generation returned HTTP 503; live output quality remains unverified.

ConsultNote is a single-user interview project for documenting doctor-patient conversations. Record or upload audio, validate and play it back, then request a speaker-labelled Gemini transcript. Correct the words and suggested doctor/patient/unknown roles before proceeding. Notes and persistence are the next milestones.

## Target workflow

1. Record or upload a fictional consultation.
2. Review the transcript and suggested speaker roles.
3. Generate notes linked to the source transcript.
4. Edit, save, reopen, or export the notes as Markdown.

## Project documents

- [Product and technical design](docs/superpowers/specs/2026-10-13-consultnote-design.md)
- [Implementation plan](docs/superpowers/plans/2026-10-13-consultnote.md)
- [AI evaluation and interview demonstration](docs/ai-evaluation.md)

## Stack

| Area | Choice |
| --- | --- |
| Application | Next.js App Router, TypeScript, Tailwind CSS |
| Runtime | Node.js 24 LTS and npm |
| AI | Gemini Developer API through the official `@google/genai` SDK |
| Configured default model | `gemini-3.8-flash`; model listing verified, successful generation pending |
| Validation | Zod |
| Storage, planned | SQLite through Node's built-in `node:sqlite` |
| Audio inspection | `file-type` signatures and FFmpeg's `ffprobe` executable |
| Verification | Vitest, Playwright, ESLint, TypeScript, production build |

Recording, upload and playback work without an AI key or paid service. Transcription requires your server-side Gemini key; the interface shows setup instructions when it is missing. Notes and saving remain unavailable in this preview.

## Run locally

Install Node.js 24 LTS and [FFmpeg](https://ffmpeg.org/download.html). Ensure `ffprobe` is on PATH (`ffprobe -version`), then run these commands from this directory:

```powershell
npm ci
npm run dev
```

Open [the local workspace](http://127.0.0.1:3000). Allow microphone access and select **Start recording**, then **Stop recording** to review it. Alternatively, select **Upload recording** and choose an MP3, WAV, WebM or OGG file. Use **Cancel** to discard an in-progress capture or validation; **Remove audio** clears the selected recording. On narrow screens, switch between the Transcript and Notes panels.

Recordings must be at most 10 MiB and 10 minutes. The browser chooses WebM/Opus or OGG/Opus and stops at 9:59 to leave room for timer delay and the final encoded packet; the server still enforces a strict 600-second limit. If recording is unsupported or permission is denied, file upload remains available. If validation fails, the selected audio stays in the tab and **Retry audio check** retries it without recording again. Microphone capture requires localhost or HTTPS.

`POST /api/audio/validate` reads at most 11 MiB of multipart data before parsing, checks the file's actual signature and audio track, and probes its duration with a 15-second timeout per probe. Browser WebM without container duration uses audio-packet timing. Validation returns only MIME type, duration and size. Audio stays in browser memory apart from temporary server inspection files, which are removed after success or failure.

Select **Transcribe audio** to send the validated recording to Gemini. `POST /api/transcribe` independently validates the upload, then makes one SDK Interactions request with inline audio, a JSON schema and a 120-second generation deadline. Automatic retries and continuation are disabled. The server validates completion, schema, IDs, speaker references and timestamps, and supplies the measured recording duration. Silence produces a distinct no-speech error.

Review the approximate timestamps, edit segment text, and choose each speaker's role. Role explanations and suggestions remain separate from your selected assignments. Empty text corrections are rejected with the previous words restored. Failed transcription retains audio and previous edits for manual retry. Draft replacement requires confirmation, and responses from cancelled or replaced drafts are ignored. Nothing is saved yet; keep the tab open while reviewing.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The type check generates Next.js route declarations before checking TypeScript, so it also works on a fresh checkout. Unit tests cover consultation contracts, evidence, bounded audio, provider failures, deadlines and real SDK request serialization. FFmpeg integration tests use synthetic audio, including silent 600- and 601-second WAVs. Browser tests cover capture, transcript editing, roles, errors, retries, draft protection and narrow screens. Provider responses are controlled in tests; no live Gemini requests are made.

Browser tests use installed Microsoft Edge on Windows and a synthetic microphone. On other platforms, install Chromium once with `npx playwright install chromium`. Stop any running `npm run dev` instance first: Playwright starts and closes its own application server on port 3100, and Next.js permits only one development server per checkout.

Use `npm run format` to format application files, tests, and configuration. Generated declarations and other Git-ignored files are excluded.

## Configuration

Copy [.env.example](.env.example) to `.env.local`, set `GEMINI_API_KEY`, and restart the app. Create the key in a free-tier [Google AI Studio project](https://aistudio.google.com/apikey). Leave `GEMINI_MODEL=gemini-3.8-flash` unless you explicitly choose another compatible model. No automatic model fallback or billing setup occurs. Keep actual keys, recordings, and the SQLite database out of Git; never put the key in a `NEXT_PUBLIC_` variable.

Google currently lists a free tier for the configured model; availability and quotas still depend on your account. Use fictional conversations. The implementation follows Google's [audio](https://ai.google.dev/gemini-api/docs/audio), [structured-output](https://ai.google.dev/gemini-api/docs/structured-output) and [pricing](https://ai.google.dev/gemini-api/docs/pricing) documentation checked on 2026-10-13. Model listing accepted the configured key, but generation checks returned provider high-demand errors; the app displays a specific temporary-service message. A diagnostic with `gemini-3.5-flash-lite` completed a short fictional sample with one incorrect date correction, then returned 503 for the five-minute MP3. The configured model remains unchanged. Full-length live processing and output quality remain unverified; see [the live-check record](docs/ai-evaluation.md).

## Version control

Use `main` for reviewed milestones and short-lived `feat/<topic>` or `fix/<topic>` branches for implementation. Commit a working vertical slice at each milestone and include the dependency lockfile once generated. This repository is local; publishing a remote is a separate step.
