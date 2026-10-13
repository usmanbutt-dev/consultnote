# Clinician Workflow and Cloud Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Improve clinician notes and usability, support English/Urdu controls, and prepare a secure Supabase-backed Vercel mode.

**Architecture:** Reuse the existing consultation contract and local workflow. Add explicit language inputs and replace presentation without removing draft protection. Cloud mode uses Supabase Auth/Postgres/private Storage and short AssemblyAI job requests; local mode remains SQLite.

**Tech Stack:** Next.js 16.4, React 19, TypeScript, Zod, Supabase SSR/JS, AssemblyAI, Groq, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-clinician-cloud-design.md`

## Global Constraints

- Preserve the existing user's SQLite database and saved AI draft.
- Next.js 16.4, React 19, Node.js 24; use bundled Next documentation.
- Keep source citations, digest validation and saved provider provenance.
- Do not merge, push, deploy, or use the finishing skill.
- English and Urdu are the prioritized languages.

## Review Focus

- Mixed-language speech: preserve source words and select a supporting provider model.
- Focused edits/navigation: retain confirmation and ignore obsolete async results.
- Hosted app missing configuration: never expose anonymous provider calls or SQLite.
- Cross-user record/storage/job identifiers: reject access before provider work.
- Slow/duplicate polling: reuse the existing job and bound provider usage.

### Task 1: Clinician notes and language controls

**Files:** `src/lib/{languages,prompts,groq,assemblyai,ai}.ts`, notes/transcribe routes, transcript/notes editor, unit provider tests.

**Interfaces:** `AudioLanguage = auto|en|ur|en-ur`; `NotesLanguage = en|ur|original`; `generateNotes(transcript, assignments, language = en)`; transcription accepts validated language.

- [x] Add failing provider-request tests for Urdu/mixed model selection and note language.
- [x] Run targeted tests and observe the behavioral failures.
- [x] Implement language inputs and clinician note instructions; keep stored section kinds compatible.
- [x] Verify unit tests and manually evaluate the existing approved transcript with Groq.
- [x] Commit the verified deliverable together with Tasks 2 and 3.

### Task 2: Guided minimal workspace

**Files:** `src/components/{consultation-workspace,audio-input,notes-editor,transcript-review}.tsx`, `src/app/globals.css`, browser tests.

**Interfaces:** Preserve existing workspace actions; add capture language and note language controls. Single-panel review and progressive capture visibility.

- [x] Add failing browser checks for guided stages and language controls.
- [x] Implement the presentation and reduced-motion transitions, reusing existing actions.
- [x] Verify mobile/desktop capture, review, edit, save/export and dirty navigation.
- [x] Commit the verified deliverable together with Tasks 1 and 3.

### Task 3: Supabase and Vercel preparation

**Files:** Supabase client/server/config helpers, proxy, auth pages/callback, storage facade, cloud job/upload routes, `supabase/schema.sql`, deployment guide, Next config and tests.

**Interfaces:** Verified owner is derived server-side. Browser uploads private audio directly; JSON validation and job endpoints return bounded results. Cloud records conform to the existing consultation schema.

- [x] Add failing tests for hosted configuration, owner boundaries, language/job requests and safe errors.
- [x] Implement SDK integration, owner RLS and atomic job limits; preserve local route behavior.
- [x] Bundle a Linux-compatible ffprobe and document private storage/auth setup.
- [x] Verify unit tests, lint, types, production build and existing browser workflow. Clearly label live cloud checks as pending credentials.
- [x] Commit the prepared integration together with Tasks 1 and 2.

### Task 4: Review and test handoff

- [x] One fresh whole-change review; apply critical/important fixes with regression tests.
- [x] Record review decisions and remaining unverified cloud/Urdu checks.
- [x] Report test results and setup instructions; leave the branch open for user testing.

Verification: 161 unit tests, all 40 browser cases across configured/keyless runs, lint, types and production build passed. Live Supabase/Vercel and representative Urdu speech checks remain pending as documented in `docs/deployment.md` and `docs/ai-evaluation.md`.
