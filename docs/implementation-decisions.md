# Implementation decisions and tradeoffs

## Doctor accounts and private profiles — 2026-10-14

Supabase remains the account provider. Signup records a name; the Auth trigger creates a private doctor profile, with backfill for existing users. Profile editing permits name, specialty and clinic only. Email remains read-only; password recovery/change is separate. Photos use a private bucket, generated owner-scoped paths, bounded signature-checked JPEG/PNG/WebP uploads and an authenticated image endpoint. Initials replace absent or unreadable photos. The former Help icon becomes an account menu with My profile and local Sign out.

Self-deletion requires same-origin input, the current password and exact DELETE, deriving identity from verified `getUser()`. It retires the profile, sets a server-only account-deletion flag, cancels owned jobs, removes all owned audio/avatar objects through Storage, then deletes Auth so foreign-key cascades remove profile/consultations/jobs/usage. Failures preserve a retry path; inactive-profile RLS blocks access from still-unexpired JWTs. Session/recovery cookies are cleared only for this Supabase project. Modern `SUPABASE_SECRET_KEY` takes priority over the supported legacy server-key name.

The account doctor's name identifies the workspace owner, not an arbitrary voice. Recorded names and unknown speaker roles remain intact. Permanent role controls move into Correct speaker labels, preserving corrections and stale-notes protection. Account links use document navigation so browser Back/Forward invokes the native unsaved-draft warning. Modified clicks keep the original tab protected. An explicitly approved departure suppresses only its own unload warning, including when a page is later restored from browser history.

The old schema is now the first versioned migration; a second adds accounts. CLI configuration, migration application, real email/storage/two-account checks and Vercel deployment are deferred at the user's request. Automated forms use a test-only DOM environment and controlled auth/API responses, with no emails or live AI calls.

## Readable note downloads — 2026-10-14

The existing Download action now opens a native browser popover offering PDF first, plain text and Markdown. PDF and text export saved notes without technical metadata or a transcript appendix; Markdown preserves the existing source links and full conversation. Every format uses the saved title for its filename, retaining spaces, capitalization and Unicode while removing filesystem-invalid characters, handling reserved Windows names and limiting UTF-8 filename length.

Browser print-to-PDF would avoid a dependency but requires a print dialog and leaves filename handling to the browser. Direct PDF downloads use [pdfmake's client API](https://pdfmake.github.io/docs/0.3/getting-started/client-side/methods/), loaded on demand with embedded Roboto fonts. This provides selectable text, pagination, headings and page numbers without another AI call, remote rendering service or Vercel runtime changes. Saving current edits remains required before any download. Sample labels remain in every format; dates are explicitly labeled as last saved.

PDF targets the app's English output. A character-coverage check derived from the pinned font files rejects unsupported custom wording before rendering and directs users to plain text or Markdown, which preserve all Unicode. This avoids silently losing Urdu characters in a manually entered title without bundling fonts for arbitrary scripts. Download descriptions are associated with their controls for screen readers.

## Guided creation and review — 2026-10-14

The default view shows recording and upload actions, with a small sample link. Audio-ready capture collapses to the player and replacement controls. A single **Create notes** action runs the existing transcription and notes calls sequentially, passing the returned transcript and suggested assignments directly into note generation. A request-generation guard prevents duplicate flow starts and skips continuation after cancellation or navigation. Failed notes retain the completed transcript; retry runs only note generation.

Working states expose a spinner, a plain stage message and Cancel, without a synthetic progress percentage. Notes are the default result view. **View conversation** optionally reveals a desktop panel or mobile view; **See in conversation** reveals and focuses a cited passage. Transcript and role edits retain the existing stale-notes confirmation and digest checks. Cancelling or failing regeneration preserves existing notes, edits and provenance.

Titles appear after processing, and Save/Download appear only once notes exist. Download retains the existing requirement to save current changes first and produces Markdown. Empty panels, the step bar, marketing copy, preview badges and history counts were removed. Body text is 16px, helper text 14px, and disabled controls use neutral colors. Existing short transitions and reduced-motion support are retained. The sample remains explicitly labeled; saved/sample conversations do not show empty capture controls when opened.

## Document layout and spoken names — 2026-10-14

Each notes section uses a shared box with editable bullet points. The notes prompt asks for concise clinical documentation, removes repeated patient prefixes where the subject is clear, and retains explicit attribution where necessary. Evidence remains part of the stored contract and export; the UI hides passage links under an optional **Check in transcript** disclosure.

The transcript uses a continuous document with role headings, optional spoken names and approximate timestamps. Speakers with identical displayed roles/names retain numbered labels. Text inputs expand to fit their contents and retain existing validation, focus, edit-confirmation and notes-invalidation behavior.

The existing Groq role request can return optional names and a short concern, each with transcript references. Names require an exact phrase plus a self-introduction by the same speaker or clear direct address to the next speaker in a two-speaker conversation. Ambiguous attribution and mentioned third parties are discarded. The concern must appear in a cited passage. These checks are conservative and do not prove identity or transcription accuracy.

New sessions suggest **Patient – Issue – Date** using the session date and reviewed roles. Editing supporting passages clears affected metadata and refreshes an automatic title; a title edited by the user or loaded from a saved record is preserved. Optional metadata is stored in the existing transcript JSON, so older records and their evidence hashes remain compatible. Existing drafts are not rewritten automatically.

## English output and paired review — 2026-10-14

- Automatically detect English, Urdu and mixed speech using Universal-2 with code switching. Request AssemblyAI's per-utterance English translation, including forced translation when English is the detected primary language. Preserve speaker IDs, turn IDs and timestamps; reject a completed response missing an English turn instead of displaying untranslated text.
- New transcripts and notes are English only. Notes use `notes-v5`; the Gemini alternative uses `transcribe-v2`. Existing saved records retain their original wording and provenance. This supersedes the earlier language-selector decisions below.
- Display transcript and notes together at the wide-desktop breakpoint, with tabs on smaller screens. Remove repeated instructions and role explanations while retaining role correction, editing, evidence links and draft protection. Keep one visible Generate notes action per layout.
- The approved English MP3 passed the live translation/notes path. Controlled Urdu turn fixtures verify mapping, but real Urdu/mixed recognition and translation quality remain unverified. Supabase configuration and hosted checks remain deferred; no finishing workflow, merge, push or deployment was performed.

These decisions were recorded during the six approved milestones. Early milestone scope limits were superseded as the user approved further work. The repository stays local on `feat/submission-workflow`; no remote or deployment was requested.
- Use a feature branch in the requested checkout rather than relocating the project — keeps the approved folder usable; no worktree was requested. Cost if wrong: weaker filesystem isolation; the planning baseline remains recoverable in Git.

- Limit execution to approved Task 1 — the user approved the explicitly presented foundation milestone, not all six milestones. Cost if wrong: later features wait for the next instruction.

- Add INTERNAL_ERROR (500) for unexpected errors — avoids mislabeling arbitrary failures as storage failures while hiding internal details. Cost if wrong: consumers must account for one additional documented error code; there are no existing consumers.

- Use direct recommended Next.js, TypeScript, and React Hooks lint plugins with ESLint 10 — the aggregate Next config bundles React/JSX plugins whose peers exclude ESLint 10. Cost if wrong: optional React style/JSX-a11y rules are not included; browser checks still cover the approved accessible interactions.

- Add POST /api/audio/validate for this milestone so uploads and real browser recordings can be independently verified before Gemini exists. Cost if wrong: one small endpoint to consolidate later; provider integration will reuse the same reader. Browser checks use the existing localhost server through an ignored temporary config to preserve the running demo.

- Stop browser recording at599s, leaving1s for scheduling and Opus packet overhead; keep server limit600s strict. Cost if wrong: users lose the final second of the nominal10-minute window; large background-timer delays can still require a shorter recording.

- Use the current SDK Interactions endpoint, not generateContent, because current Google audio/structured-output docs target it and it has no automatic continuation loop. Cost if wrong: live model compatibility could require a private adapter change; transport shape is verified against installedSDK2.29.0. Key absent in both .env.local and inherited environment; live access/quality remains explicitly unverified.

- original contracts stay; Node24 built-in SQLite avoids native dependency setup. No extra milestone approval needed; user accepted full submission workflow. Provider-only secrets remain in ignored.env.

- smaller roletext input+1024tokens and notes4096 fits8kTPM; role inference15s fallsbackunknown withoutlosingASR. User explicitly approved fullMP3 egress toAssemblyAIandGroq after automaticreviewrejected ambiguousinitialscope. LivefullMP3ASR15.4s,35segments,2speakersdoctor/patient; Firefoxfullworkflowcheckrunning. SQLite9tests/export2tests pass; submissionbrowser6/6plus save-raceRED->GREEN. Fullpriorbrowsers26pass1keycase skipped. Lint/typespass; productionbuildpassed with tracingwarning then documentedturbopackIgnore added (rerun pending). CI/demoREADMEprepared. Finalfreshreview/live3fictionalsamples/fullfinalchecks pending.

- preserve generation provenance across reopen/rename, including old prompt versions — prevents false model/sample attribution; cost if wrong: a small additional draft state field. One fix pass, no re-review.
The submission workflow was committed together because its provider, note, persistence and UI contracts were verified together. The cost is less granular reversion than separate milestone commits.

The role request retains all spoken text but omits timestamps and uses a 1,024-token output budget. Its 15-second deadline preserves the completed transcript with unknown roles on failure. The cost is manual role review if inference is slow or unavailable. Node's built-in SQLite removes an extra native dependency but requires Node 24 as documented.

Final review: focused-edit loss, implicit Gemini selection and rewritten note provenance were reproduced by failing tests and fixed. The provenance finding was regraded Important because an unchanged saved result must not claim a new model or sample origin. No deferred minor findings remain. One fresh review and one fix pass were performed; covering regressions and the full suite verified the fixes.

Hosted CI, public deployment, natural overlapping speech, multilingual quality and real human microphone-to-AI accuracy remain unverified. See [AI evaluation](ai-evaluation.md) for measured behavior.

## Clinician workflow and cloud preparation

- Continue the existing feature branch and live checkout. The user wants to test changes locally and preserve the saved cost-of-care draft. The finishing skill, merge, push and deployment remain excluded.
- Preserve stored note section keys and map them to clinician labels. New notes use `notes-v4`; existing notes retain their original text/model/prompt, and selected note language is recorded in new provenance.
- Use Universal-2 for Urdu and mixed English/Urdu requests. Recording language and note language are independent. Real Urdu speech recognition and semantic note quality still require review against representative recordings.
- Cloud mode uses verified Supabase users, owner RLS, private Storage and server-only transcription-job mutations. A service-role key is needed for job bookkeeping and atomic usage limits; it is never exposed to the browser. Actual Supabase installation and two-account checks are deferred at the user's request.
- Send cloud audio directly to private Storage and use JSON validation/job requests. This avoids sending the recording through Vercel's function request body. Linux ffprobe is traced into audio functions; real hosted execution is pending.
- Keep pending job IDs after interrupted connections or unconfirmed gateway errors. Confirmed application submission failures clear failed job state so one manual retry can upload and start fresh.
- Retire the old cloud job only after replacement audio, reset, or draft navigation actually succeeds. Failed validation and cancelled microphone permission preserve the ready original recording and resumable job. Both replacement cases have browser regressions.
- Raise the Next proxy body buffer to 12 MiB so multipart overhead does not truncate a valid 10 MiB recording before the app's own limits run. The oversized-upload rejection remains tested.
- Commit the shared provider, workspace and cloud changes together to avoid intermediate commits with missing imports. One fresh final review reported one Important replacement bug and one Minor retry issue; both were fixed in one pass with behavioral regressions, without another review.
- Leave pre-existing lint-tool advisories to a dependency maintenance task. The suggested audit fix downgrades Next's ESLint plugin from 16 to 14; the current application dependency additions introduced no reported runtime advisory in the audit.
