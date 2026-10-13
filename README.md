# ConsultNote

AI-assisted notes for doctor-patient conversations, with a source transcript and human review.

**Status:** Planning baseline. Application implementation has not started.

ConsultNote is a single-user interview project. It records microphone audio or accepts an uploaded recording, distinguishes speakers, suggests doctor/patient roles, and creates editable notes covering the conversation. Gemini provides the AI processing.

## Planned experience

1. Record or upload a fictional consultation.
2. Review the transcript and suggested speaker roles.
3. Generate notes linked to the source transcript.
4. Edit, save, reopen, or export the notes as Markdown.

## Project documents

- [Product and technical design](docs/superpowers/specs/2026-10-13-consultnote-design.md)
- [Implementation plan](docs/superpowers/plans/2026-10-13-consultnote.md)
- [AI evaluation and interview demonstration](docs/ai-evaluation.md)

## Planned stack

| Area | Choice |
| --- | --- |
| Application | Next.js App Router, TypeScript, Tailwind CSS |
| Runtime | Node.js 24 LTS and npm |
| AI | Gemini Developer API through the official `@google/genai` SDK |
| Initial model | `gemini-3.8-flash`; confirm account access before the first live test |
| Validation | Zod |
| Storage | SQLite through Node's built-in `node:sqlite` |
| Audio inspection | FFmpeg's `ffprobe` executable |
| Verification | Vitest, Playwright, ESLint, TypeScript, production build |

Gemini's published free tier is subject to model availability and quotas. Use a free-tier Google AI Studio project and fictional conversations. The app will not switch to another model automatically.

## Configuration

The future application will read `.env.local`, copied from [.env.example](.env.example). The Gemini key belongs on the server. Keep actual keys, recordings, and the SQLite database out of Git.

Dependency installation and runnable application commands are part of implementation task 1; there is no application to run yet.

## Version control

Use `main` for reviewed milestones and short-lived `feat/<topic>` or `fix/<topic>` branches for implementation. Commit a working vertical slice at each milestone and include the dependency lockfile once generated. This repository is local; publishing a remote is a separate step.
