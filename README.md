# ConsultNote

AI-assisted notes for doctor-patient conversations, with a source transcript and human review.

**Status:** Milestones 1–2 implemented: application foundation, microphone recording and validated audio uploads.

ConsultNote is a single-user interview project for documenting doctor-patient conversations. The working app records microphone audio, accepts uploaded recordings, validates their format and duration on the server, and plays them back for review. Gemini transcription, speaker suggestions, notes and persistence are the next milestones.

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
| AI, planned | Gemini Developer API through the official `@google/genai` SDK |
| Initial model, planned | `gemini-3.8-flash`; confirm account access before the first live test |
| Validation | Zod |
| Storage, planned | SQLite through Node's built-in `node:sqlite` |
| Audio inspection | `file-type` signatures and FFmpeg's `ffprobe` executable |
| Verification | Vitest, Playwright, ESLint, TypeScript, production build |

The workspace is labeled as a preview. Recording, upload and playback work without an AI key or paid service. Transcription, notes and saving remain unavailable until their milestones are implemented.

## Run locally

Install Node.js 24 LTS and [FFmpeg](https://ffmpeg.org/download.html). Ensure `ffprobe` is on PATH (`ffprobe -version`), then run these commands from this directory:

```powershell
npm ci
npm run dev
```

Open [the local workspace](http://127.0.0.1:3000). Allow microphone access and select **Start recording**, then **Stop recording** to review it. Alternatively, select **Upload recording** and choose an MP3, WAV, WebM or OGG file. Use **Cancel** to discard an in-progress capture or validation; **Remove audio** clears the selected recording. On narrow screens, switch between the Transcript and Notes panels.

Recordings must be at most 10 MiB and 10 minutes. The browser chooses WebM/Opus or OGG/Opus and stops at 9:59 to leave room for timer delay and the final encoded packet; the server still enforces a strict 600-second limit. If recording is unsupported or permission is denied, file upload remains available. If validation fails, the selected audio stays in the tab and **Retry audio check** retries it without recording again. Microphone capture requires localhost or HTTPS.

`POST /api/audio/validate` reads at most 11 MiB of multipart data before parsing, checks the file's actual signature and audio track, and probes its duration with a 15-second timeout per probe. Browser WebM without container duration uses audio-packet timing. Validation returns only MIME type, duration and size. Audio stays in browser memory apart from temporary server inspection files, which are removed after success or failure; it is not saved or sent to Gemini yet.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The type check generates Next.js route declarations before checking TypeScript, so it also works on a fresh checkout. Unit tests cover consultation contracts, evidence, bounded requests, audio signatures, duration limits and temporary-file cleanup. Real FFmpeg integration tests use synthetic audio, including silent 600- and 601-second WAVs. Browser tests cover recording, playback, denied/unsupported microphones, replacement, cancellation, automatic stopping and narrow-screen panels; they make no AI requests.

Browser tests use installed Microsoft Edge on Windows and a synthetic microphone. On other platforms, install Chromium once with `npx playwright install chromium`. Stop any running `npm run dev` instance first: Playwright starts and closes its own application server on port 3100, and Next.js permits only one development server per checkout.

Use `npm run format` to format application files, tests, and configuration. Generated declarations and other Git-ignored files are excluded.

## Configuration

The later Gemini integration will read `.env.local`, copied from [.env.example](.env.example). The Gemini key belongs on the server. Keep actual keys, recordings, and the SQLite database out of Git.

Gemini's published free tier is subject to model availability and quotas. Use a free-tier Google AI Studio project and fictional conversations. Live Gemini access and output quality have not been tested yet; the app will not switch to another model automatically.

## Version control

Use `main` for reviewed milestones and short-lived `feat/<topic>` or `fix/<topic>` branches for implementation. Commit a working vertical slice at each milestone and include the dependency lockfile once generated. This repository is local; publishing a remote is a separate step.
