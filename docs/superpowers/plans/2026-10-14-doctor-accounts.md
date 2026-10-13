# Doctor Accounts Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline, task by task. One fresh read-only review at the end; no implementation delegation.

**Goal:** Complete doctor account access, private profiles/photos, self-deletion and a minimal account menu.

**Architecture:** Reuse Supabase Auth/SSR and owner-scoped storage. Add private profiles and avatar storage, authenticated account routes and focused UI components. Keep the existing local demo usable until cloud setup.

**Tech stack:** Existing Next.js, React, TypeScript, Zod, Supabase SDK, file-type and native browser controls; no new product dependency.

**Spec:** `docs/superpowers/specs/2026-10-14-doctor-accounts-design.md`

## Global constraints

- Implement locally; Supabase CLI/project setup, Git remote connection and Vercel deployment are deferred at the user's request.
- Preserve English output, current AI providers, evidence/digests, saved consultations and downloads.
- Account data and avatars are private; owner IDs come from verified sessions.
- Profile edits cover full name (1–80), specialty (0–80), clinic (0–100) and a JPEG/PNG/WebP photo up to 2 MiB.
- Current password plus exact DELETE is required for permanent self-deletion.
- Server secrets remain server-only; support modern and legacy Supabase server key names.

## Review focus

1. Cross-account IDs, foreign avatar paths and cross-origin requests must never reach privileged mutation.
2. Failed photo upload/profile save must retain existing profile and clean new orphan uploads.
3. Wrong password, partial deletion or storage failure must never report a deleted account.
4. Email callback/recovery destinations must not allow external redirects.
5. Transcript role changes and profile navigation must preserve existing edit protections.

## Task 1: Account contracts, storage and routes

**Files:** `src/lib/account.ts`, `src/lib/account-server.ts`, `src/lib/supabase/server.ts`, `src/lib/http.ts`, `src/app/api/account/route.ts`, `src/app/api/account/avatar/route.ts`, `src/app/api/auth/signout/route.ts`, `supabase/migrations/20261014000100_doctor_accounts.sql`, `.env.example`, `tests/unit/account*.test.ts`. The prior cloud schema moves to `supabase/migrations/20261013000100_initial.sql` so a fresh project can use CLI migrations directly.

**Interfaces:** Shared `DoctorProfile` contains id/email/fullName/specialty/clinic/avatarPath/deleting. `readDoctorProfile(owner)` reads only the verified owner. GET/PATCH/DELETE `/api/account` read/edit/delete self; GET/POST/DELETE `/api/account/avatar` read/upload/remove own photo. No target user parameter.

- [x] Write and observe failing account tests: invalid inputs, anonymous/local mode, foreign origin/path, wrong password, failed cleanup and owner-only operations.
- [x] Add Zod contracts, private profile migration, avatar validation/storage and deletion sequencing.
- [x] Add modern server-key support and safe sign-out behavior.
- [x] Run account tests and existing cloud boundary tests; verify no real service calls.

## Task 2: Access and profile UI

**Files:** `src/components/auth-form.tsx`, `src/components/profile-avatar.tsx`, `src/components/profile-menu.tsx`, `src/components/profile-editor.tsx`, `src/components/password-form.tsx`, `src/app/account/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/page.tsx`, `src/proxy.ts`, browser tests.

**Interfaces:** Home passes a verified optional `DoctorProfile` to Workspace. Account pages receive the same profile; profile editing uses account routes. Recovery redirects only to `/reset-password` after exchanging a code.

- [x] Add failing browser/route tests for menu, profile actions and safe callback/recovery behavior.
- [x] Extend signup with full name; add forgotten-password and change-password flows with useful pending/error/success states.
- [x] Add private photo/initials rendering and profile menu; implement profile edits, photo removal and typed/password-confirmed deletion.
- [x] Preserve navigation/logout warnings for unsaved consultations; handle expired sessions and retryable deletion.
- [x] Run relevant browser and route checks.

## Task 3: Transcript cleanup and final verification

**Files:** `src/components/consultation-workspace.tsx`, `src/components/transcript-review.tsx`, existing browser tests, `README.md`, `docs/deployment.md`, `docs/implementation-decisions.md`.

- [x] Add failing checks for hidden permanent speaker controls and optional correction without losing source/digest protections.
- [x] Replace Help with the avatar menu and move role controls into Correct speaker labels. Retain names from audio and unknown roles.
- [x] Document SQL order, CLI setup deferred, email limits and the required later live two-account/account-deletion checks.
- [x] Run full unit, lint, types, format, production build and isolated browser suites; visually check desktop/mobile.
- [x] Obtain one fresh read-only review, fix concrete findings once, and inspect local SQLite without changing it.
- [x] Commit focused changes. Leave the branch open for user testing; no merge, push or deployment.

## Verification record — 2026-10-14

- 210 unit tests, 50 isolated production browser tests, lint, types, formatting and production build passed.
- The reviewer found a browser-history draft-loss bug. A failing browser reproduction preceded the document-navigation fix; Back now prompts and retains dismissed drafts.
- Actual profile markup was visually checked with a fictional fixture at desktop and 390px mobile widths; no horizontal overflow. The production suite also covers the workspace, recording and downloads.
- Production save/restart/reopen/delete passed against a separate ignored database, with provider keys empty and no cloud calls.
- The local database was readable; history was empty at the final inspection. No local records were imported or recreated. Cloud migrations, real email delivery, private Storage/RLS and live account deletion remain deferred until CLI setup.
