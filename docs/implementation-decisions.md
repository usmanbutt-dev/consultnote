# Implementation decisions and tradeoffs

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