# ConsultNote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Task 1 is complete; Tasks 2–6 remain planned.

**Goal:** Deliver an interview-ready web app that records/uploads a fictional consultation, reviews a speaker-labeled transcript, generates source-linked notes with Gemini, and persists edited results.

**Architecture:** One Next.js application owns the browser workflow and Node route handlers. Server-only modules validate audio, call Gemini, and persist consultations in SQLite. Users review transcript/role suggestions before generating notes.

**Tech Stack:** Node.js 24 LTS, npm, Next.js App Router, strict TypeScript, Tailwind CSS, `@google/genai`, Zod, `file-type`, `node:sqlite`, FFmpeg/ffprobe, Vitest, Playwright.

**Spec:** [Product and technical design](../specs/2026-10-13-consultnote-design.md).

## Global constraints

- Single-user localhost interview demo using fictional conversations; Gemini first.
- `GEMINI_MODEL=gemini-3.8-flash`; confirm free-tier account access before the first live test. No automatic model substitution or billing activation.
- Audio file limit: 10 MiB (10,485,760 bytes); multipart request limit: 11 MiB (11,534,336 bytes); duration limit: 10 minutes (600 seconds).
- Supported inputs: MP3, WAV, WebM, OGG. Audio inspection deadline: 15 seconds; generation deadline: 120 seconds per request.
- Output budgets: 16,384 tokens for transcription and 8,192 tokens for notes. No application-level automatic retries or automatic continuation.
- JSON request bodies are limited to 1 MiB. Provider JSON must pass Zod and cross-reference validation.
- Speaker roles are `doctor`, `patient`, or `unknown`. Preserve ambiguity; every note item cites transcript segment IDs.
- A transcript/role edit invalidates notes; reject stale source digests at save/update time.
- Keep credentials and Gemini calls server-only. Audio and databases remain untracked; CI makes no Gemini calls.
- Use the spec's exact types, routes, statuses, and `{ error: { code, message } }` contract.

## Review focus

1. Browser WebM without container duration: calculate duration from audio packets or reject clearly; never silently skip the duration limit. Task 2.
2. A third voice or ambiguous doctor/patient identity: retain every speaker and permit `unknown`. Tasks 1 and 3.
3. Spoken prompt injection, silence, or truncated AI output: preserve extraction instructions and surface failure, with the audio available to retry. Task 3 and live evaluation.
4. Transcript or role changes during note generation: discard stale responses and block saving mismatched notes. Task 4.
5. Database failure or navigation with unsaved edits: retain the draft and ask before destructive draft replacement. Tasks 5 and 6.

## File responsibilities

| Planned path | Responsibility |
| --- | --- |
| `src/app/layout.tsx`, `globals.css`, `page.tsx` | Application layout, design tokens, consultation workspace |
| `src/components/audio-input.tsx` | Microphone/upload capture and preview lifecycle |
| `src/components/transcript-review.tsx` | Transcript corrections and role review |
| `src/components/notes-editor.tsx` | Note editing and source navigation |
| `src/components/consultation-workspace.tsx`, `consultation-history.tsx` | Draft state, actions, and saved consultation navigation |
| `src/lib/consultation.ts`, `evidence.ts` | Domain schemas, cross-reference checks, source digest |
| `src/lib/audio.ts`, `http.ts` | Bounded input, audio inspection, safe error contract |
| `src/lib/gemini.ts`, `prompts.ts` | Server-only SDK use and versioned extraction instructions |
| `src/lib/db.ts`, `markdown.ts` | SQLite CRUD and plain Markdown export |
| `src/app/api/transcribe/route.ts`, `api/notes/route.ts` | AI processing endpoints |
| `src/app/api/consultations/route.ts`, `api/consultations/[id]/route.ts` | Persistence endpoints |
| `tests/unit/`, `tests/e2e/`, `tests/fixtures/` | Focused logic tests, workflow tests, synthetic fixtures |
| `.github/workflows/ci.yml`, `docs/demo.md` | Reproducible verification and interview runbook |

Use `@/*` as the `src/*` import alias. Unit tests use Vitest's Node environment; browser interactions use Playwright. Share domain types rather than duplicating API payloads.

### Task 1: Application foundation and domain contracts

**Files:** `package.json`, `package-lock.json`, Next/TypeScript/ESLint/PostCSS/Vitest/Playwright configuration, `src/app/{layout.tsx,page.tsx,globals.css,icon.svg}`, `src/components/consultation-workspace.tsx`, `src/lib/{consultation.ts,evidence.ts,http.ts}`, `tests/unit/{consultation.test.ts,http.test.ts}`, `tests/e2e/workspace.spec.ts`, `tests/fixtures/{transcript.json,notes.json}`, `README.md`.

**Interfaces:** Export the spec's domain types and `transcriptSchema`, `assignmentsSchema`, `notesSchema`, `consultationInputSchema`. Export `validateNotes(notes: Notes, transcript: Transcript): void`, `sourceDigest(transcript: Transcript, assignments: SpeakerAssignment[]): string`, and `ApiError(code, message, status)` with `errorResponse(error: unknown): Response`. Place bounded JSON/multipart helpers in `http.ts` as later tasks require them.

- [x] Scaffold manually in the existing repository, preserving its planning documents. Configure npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, and `test:e2e`. Use `next dev --hostname 127.0.0.1` and `next start --hostname 127.0.0.1` for local demo scripts. Resolve compatible stable dependencies, including Zod JSON-schema conversion, and commit the lockfile.
- [x] Write failing tests: `rejectsDuplicateSpeakerIds`, `rejectsUnknownSegmentSpeaker`, `retainsThirdUnknownSpeaker`, `rejectsMissingEvidence`, `rejectsUnknownEvidenceId`, `rejectsDuplicateSectionKinds`, `digestChangesWhenTranscriptOrRolesChange`, and `digestIgnoresAssignmentOrder`. Use the spec's exact bounds and enums; fixtures describe a fictional consultation with explicit decisions and uncertainty.
- [x] Run `npm test -- tests/unit/consultation.test.ts`; verify failures identify the unimplemented contracts.
- [x] Implement the schemas, relational checks, canonical digest, and safe error helper. Implement a responsive shell with a consultation sidebar, empty workspace, and labeled controls. Add no AI calls in client modules.
- [x] Run the focused tests, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`; verify exit code 0. The application must build with no Gemini key.
- [x] Commit: `feat: establish application foundation and consultation contracts`.

### Task 2: Audio capture and validated upload

**Files:** `src/components/audio-input.tsx`, `src/lib/audio.ts`, `src/lib/http.ts`, `tests/unit/audio.test.ts`, `tests/e2e/audio-input.spec.ts`, `tests/fixtures/audio/`, `README.md`.

**Interfaces:** Export `ValidatedAudio = { bytes: Uint8Array; mimeType: string; durationSeconds: number }` and `readAudioRequest(request: Request): Promise<ValidatedAudio>`. `AudioInput` calls `onAudioReady(file: File)` and `onReset()`; its preview and microphone remain browser-owned. Add `readJsonRequest(request: Request): Promise<unknown>` enforcing the 1 MiB bound for subsequent endpoints.

- [x] Verify Node 24, `ffprobe`, and the supported recording MIME types on the demonstration machine. Document FFmpeg installation if missing; do not substitute unchecked metadata for inspection.
- [x] Write failing tests for request/file bounds, unsupported or misleading file signatures, missing audio tracks, unreadable input, duration 600 versus 601 seconds, WebM packet-duration fallback, probe timeout, and temporary-file cleanup. Add real generated WAV/silent fixtures plus a short browser-recorded fictional WebM for the integration check; keep mocked probe-result fixtures separate from actual audio.
- [x] Run `npm test -- tests/unit/audio.test.ts`; confirm expected failures. Add Playwright cases for upload preview, denied microphone permission, unsupported recording format with upload still enabled, track cleanup, and repeated input replacement.
- [x] Implement bounded multipart/JSON readers, `file-type` identification, safe temporary inspection with `ffprobe`, and independent server-side validation. Implement start/stop, 600-second auto-stop, input level, preview, reset, and object-URL cleanup.
- [x] Run the focused unit and browser tests. Manually inspect one actual MediaRecorder WebM with the server validator; test both accepted input and an oversized upload before any provider call exists.
- [x] Commit: `feat: add microphone recording and validated audio uploads`.

Implementation notes: `POST /api/audio/validate` makes this milestone independently usable before provider integration. Browser recording stops at 599 seconds to allow scheduling and packet overhead; server validation retains the strict 600-second limit. Failed validation retains the candidate audio for retry.

### Task 3: Gemini transcription and speaker review

**Files:** `src/lib/{gemini.ts,prompts.ts}`, `src/app/api/transcribe/route.ts`, `src/components/{transcript-review.tsx,consultation-workspace.tsx}`, `src/app/page.tsx`, `tests/unit/gemini.test.ts`, `tests/e2e/transcription.spec.ts`, `.env.example`, `docs/ai-evaluation.md`.

**Interfaces:** Export `transcribeAudio(audio: ValidatedAudio): Promise<{ transcript: Transcript; model: string; promptVersion: string }>` and implement `POST /api/transcribe`. `TranscriptReview` receives the current transcript/assignments and emits validated transcript/assignment edits. Keep all SDK calls and key reads in a server-only module.

- [x] Write failing provider-boundary tests for valid speaker/segment mapping, third/unknown speakers, silence, empty or truncated output, schema/reference errors, missing key, authentication, model unavailability, quota, timeout, and disabled continuation. Assert the spec's public statuses/messages and absence of secrets/provider payloads.
- [x] Run `npm test -- tests/unit/gemini.test.ts`; verify the failing behavior before implementation.
- [x] Implement the first versioned prompt and bounded Gemini call using the current official audio/JSON-schema SDK endpoint. Validate the complete response before returning data. Distinguish `NO_SPEECH` from malformed output, and preserve `unknown` when roles cannot be inferred.
- [x] Connect recording/upload to transcription, display approximate timestamps and role explanations, and allow text/role corrections. Disable duplicate submissions and keep failed input available for manual retry. Discard responses for a replaced draft.
- [x] Run provider unit tests and `npm run test:e2e -- tests/e2e/transcription.spec.ts` using controlled API responses. Verify a quota error preserves the audio and permits a user-initiated retry.
- [x] With a user-configured free-tier key, run one short fictional live sample. Record exact model, SDK/API endpoint, prompt version, latency, and output; verify model access, supported MIME types, structured output, and completion flags. If a key is unavailable, report live AI quality/access as unverified while completing mock-based application checks.
- [x] Commit: `feat: transcribe consultations with Gemini and review speaker roles`.

Implementation notes: SDK 2.29.0 uses `interactions.create` on `/v1beta/interactions`, with retries disabled and no continuation loop. No key was configured; live access, MIME/schema acceptance and output quality remain unverified in `docs/ai-evaluation.md`. Audio replacement, including retrying a pending upload, confirms before discarding a transcript. Review is disabled during capture/validation or retranscription.

### Task 4: Source-linked notes and editing

**Files:** `src/lib/{gemini.ts,prompts.ts,evidence.ts}`, `src/app/api/notes/route.ts`, `src/components/{notes-editor.tsx,consultation-workspace.tsx}`, `tests/unit/notes.test.ts`, `tests/e2e/notes.spec.ts`.

**Interfaces:** Export `generateNotes(transcript: Transcript, assignments: SpeakerAssignment[]): Promise<NotesResult>`. Implement `POST /api/notes` using reviewed input and a server-computed `sourceDigest`. `NotesEditor` consumes `NotesResult` and emits note-item text edits; source links target transcript segment IDs.

- [ ] Write failing tests for missing/foreign source references, unsupported or duplicate section kinds, source-digest changes, meaningful uncertainty, and empty AI output. Browser tests cover role correction before generation, plain-text rendering, source-link focus, and stale responses after a transcript/role edit.
- [ ] Run `npm test -- tests/unit/notes.test.ts`; confirm failures name the missing behavior.
- [ ] Implement the second bounded Gemini call and grounded note prompt. Include supported discussion/context; preserve uncertainties and return evidence for each note item. Validate request body size, response structure, and references.
- [ ] Connect the explicit Generate notes action, editing, and source navigation. Confirm before clearing edited notes on transcript/role changes; retain the draft on failed generation. Use the source digest to reject responses for obsolete input.
- [ ] Run focused unit/browser tests. Manually compare a fictional audio sample, reviewed transcript, and notes; source references alone are not an accuracy assertion.
- [ ] Commit: `feat: generate editable consultation notes with transcript evidence`.

### Task 5: Persistence, history, and Markdown export

**Files:** `src/lib/{db.ts,markdown.ts}`, `src/app/api/consultations/route.ts`, `src/app/api/consultations/[id]/route.ts`, `src/components/{consultation-history.tsx,consultation-workspace.tsx}`, `tests/unit/{db.test.ts,markdown.test.ts}`, `tests/e2e/consultations.spec.ts`.

**Interfaces:** Export `createConsultation(input: ConsultationInput): ConsultationRecord`, `listConsultations(): ConsultationSummary[]`, `getConsultation(id: string): ConsultationRecord | null`, `updateConsultation(id: string, input: ConsultationInput): ConsultationRecord | null`, `deleteConsultation(id: string): boolean`, and `toMarkdown(record: ConsultationRecord): string`. Initialize SQLite lazily at runtime with `DATABASE_PATH`; production build must not require a preexisting DB.

- [ ] Write failing tests against a temporary real SQLite database: create/list/read/update/delete, reopening the database, preserved creation time, updated ordering, malformed IDs, nonexistent IDs, stale digest rejection, safe title/text round-trip, and storage failure. Export tests assert corrected roles, note sections, source references, and the transcript are preserved.
- [ ] Run `npm test -- tests/unit/db.test.ts tests/unit/markdown.test.ts`; verify expected failures.
- [ ] Implement the single-table prepared-statement store and all specified routes. Validate full payloads and evidence/digests before writes. Return stable server IDs/timestamps and the spec's not-found/storage errors.
- [ ] Connect save/update, history, reopen, rename, confirmed deletion, and native Blob-based Markdown download. Preserve drafts on errors and confirm navigation/reset that would discard unsaved edits.
- [ ] Run the unit tests and `npm run test:e2e -- tests/e2e/consultations.spec.ts`. Restart the app and reopen a saved fictional consultation; verify microphone/upload recordings are absent from the SQLite payload.
- [ ] Commit: `feat: persist consultations and export reviewed notes`.

### Task 6: Interview release and repeatable verification

**Files:** `.github/workflows/ci.yml`, `tests/e2e/workflow.spec.ts`, `docs/{ai-evaluation.md,demo.md}`, `README.md`, relevant UI files requiring final accessibility/responsive fixes.

**Interfaces:** Existing npm scripts become the documented verification contract. CI installs the locked dependencies and FFmpeg, uses a temporary ignored SQLite database, and stubs Gemini at the HTTP boundary. Live evaluations remain manual and separately labeled.

- [ ] Add browser regressions for the full upload-to-save/reopen/export flow, keyboard source navigation, narrow-screen transcript/notes tabs, destructive navigation cancellation, and saved-example labeling during a provider failure. Use synthetic audio and no paid/cloud calls in CI.
- [ ] Run the new browser cases and fix only demonstrated workflow/accessibility defects. Check visible focus, labels, status announcements, disabled duplicate actions, and long transcript/note layout at desktop and narrow widths.
- [ ] Add CI running `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, Playwright browser installation, and `npm run test:e2e`. Verify the same commands locally with no live key for automated checks.
- [ ] Evaluate at least three fictional recordings using `docs/ai-evaluation.md`, including ambiguity/nonmedical context and interruptions or noise. Record observed transcript, speaker, role, evidence, and note errors rather than claiming a preset accuracy score. Keep live-access failures explicit.
- [ ] Write `docs/demo.md`: prerequisites, local setup, key configuration, five-minute demonstration, architecture explanation, measured limitations, and a clearly labeled saved-example fallback. Update README from planned to implemented only for delivered features.
- [ ] Run the complete verification contract, review the diff for secrets/unrelated changes, and confirm `git status --short` is clean after committing. Summarize any unverified live API behavior separately.
- [ ] Commit: `chore: prepare verified interview demonstration`.

## Implementation handoff

Milestone 1 is implemented. Subsequent execution starts with Task 2, audio capture and validated uploads. Keep mock-based software verification separate from real Gemini quality evaluation. A remote repository, public deployment, or paid service activation requires a subsequent explicit instruction.

## Approved submission-day execution update

Resume after completed Tasks 1–3. The user supplied AssemblyAI/Groq keys after accepting the replacement proposal; execute the remaining workflow inline without another milestone pause.

1. Provider boundary: add `src/lib/{assemblyai,groq,ai}.ts`; retain Gemini. Test job polling, speaker/timestamp normalization, role references, authentication/quota/deadlines and safe errors. Verify one live MP3 request before relying on this path.
2. Task 4: implement `POST /api/notes`, Groq evidence-linked notes and `NotesEditor`. Test foreign evidence rejection, stale generation and preservation of edits after failures.
3. Task 5: implement existing SQLite/HTTP/Markdown contracts using `node:sqlite`; test real temporary databases, stale digest rejection, CRUD, restart persistence and export contents.
4. Task 6: wire complete workspace/history, explicit sample loading and persistent sample labeling. Test upload → review → notes → save → reopen → export, failures, confirmations and mobile navigation. Document setup and the five-minute interview demonstration.
5. Run the full existing verification contract, inspect desktop/mobile screenshots, obtain one fresh whole-branch review, address important findings and commit a clean local branch. Live output is evaluated separately from controlled browser tests.
