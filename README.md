# ConsultNote

AI-assisted notes for doctor-patient conversations, with a source transcript and human review.

**Status:** Milestone 1 implemented: application foundation and consultation contracts.

ConsultNote is a single-user interview project for documenting doctor-patient conversations. The working foundation includes a responsive consultation workspace, input-method previews, transcript/notes panels, and validated data contracts. Recording, uploaded-audio processing, Gemini integration, and persistence are the next milestones.

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
| Audio inspection, planned | FFmpeg's `ffprobe` executable |
| Verification | Vitest, Playwright, ESLint, TypeScript, production build |

The current workspace is visibly labeled as a preview. Recording, file selection, and saving are disabled until their milestones are implemented. No AI key, FFmpeg installation, or paid service is needed to run this foundation.

## Run locally

Install Node.js 24 LTS, then run these commands from this directory:

```powershell
npm ci
npm run dev
```

Open [the local workspace](http://127.0.0.1:3000). Use the Record audio / Upload recording controls to preview the input modes. On narrow screens, switch between the Transcript and Notes panels.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The type check generates Next.js route declarations before checking TypeScript, so it also works on a fresh checkout. Unit tests cover speaker/segment relationships, note evidence, role assignments, source digests, and public error responses. Browser tests cover the empty preview, input-mode changes, and narrow-screen panels; they make no AI requests.

Browser tests use installed Microsoft Edge on Windows. On other platforms, install Chromium once with `npx playwright install chromium`. Playwright starts and closes its own application server on port 3100.

Use `npm run format` to format application files, tests, and configuration. Generated declarations and other Git-ignored files are excluded.

## Configuration

The later Gemini integration will read `.env.local`, copied from [.env.example](.env.example). The Gemini key belongs on the server. Keep actual keys, recordings, and the SQLite database out of Git.

Gemini's published free tier is subject to model availability and quotas. Use a free-tier Google AI Studio project and fictional conversations. Live Gemini access and output quality have not been tested yet; the app will not switch to another model automatically.

## Version control

Use `main` for reviewed milestones and short-lived `feat/<topic>` or `fix/<topic>` branches for implementation. Commit a working vertical slice at each milestone and include the dependency lockfile once generated. This repository is local; publishing a remote is a separate step.
