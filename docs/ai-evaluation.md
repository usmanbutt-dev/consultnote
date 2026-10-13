# AI evaluation and interview demonstration

## Doctor account verification — 2026-10-14

Signup/login, confirmation and recovery UI, minor profile edits, private photo handling and password-confirmed self-deletion are implemented. Account server and form checks use controlled Supabase/API responses; no live email, authentication or AI requests were made. The workspace keeps recorded speaker names distinct from the account owner, with optional speaker correction.

Verification passed 210 unit tests, all 50 browser tests against the optimized production build with empty provider keys and an isolated database, lint, type checks and formatting. Save/restart/reopen/delete passed separately. A browser-history draft-loss regression failed before the document-navigation fix and passed afterward. The cloud browser harness explicitly supplies the image configuration normally injected by Next.js. Desktop/mobile profile markup was visually inspected using a fictional fixture, with no horizontal overflow.

Supabase CLI/project linking, migration application, live email delivery, two-account RLS/Storage isolation and real self-deletion remain unverified until the deferred cloud setup. No deployment was performed. These application checks do not measure transcription or clinical accuracy.

## Note download verification — 2026-10-14

PDF, plain-text and Markdown downloads use the saved consultation title. No provider adapter, prompt or AI output was changed. Verification passed 181 unit tests, all 47 browser tests against the production build with empty AI keys and an isolated database, lint, type checks and the optimized build. Browser checks read actual PDFs to verify saved edits, accented text, title metadata, six-page pagination and page numbers. An unsupported Urdu custom title produces an explicit font message and a working Unicode text download. The fictional PDF and desktop/mobile picker were visually inspected without browser errors.

The production save/restart/reopen/delete check passed. The current local saved consultation reopens with 32 transcript turns and 13 notes; temporary browser and preview records were removed. No live AI request, merge, push or deployment was performed for this feature.

## Guided workflow verification — 2026-10-14

The client now runs transcription followed by notes from one **Create notes** action. Provider adapters, prompts and provenance formats are unchanged in this UI pass. New browser coverage checks the combined result, notes-only retry after a notes failure, and cancellation after transcription completes. Existing coverage was adapted to preserve focused edits, source navigation, save/reopen/download, regeneration failure, recording replacement and cloud job retry behavior. These checks use controlled provider responses and make no live AI calls.

Final verification passed 173 unit tests and all 44 browser tests against the production build with empty provider keys and an isolated database, including the actionable missing-key error. Lint, type checks and the optimized build passed. A production restart retained the saved test record; deletion then returned 404. Desktop/mobile sample previews reported no browser errors. The original local consultation remains unchanged with 35 transcript turns and 13 notes; one saved consultation remains. No new live provider call, merge, push or deployment was performed.

## Concise notes and spoken names — 2026-10-14

Reused the explicitly approved trimmed cost-of-care MP3 with AssemblyAI and Groq. The 300.19-second recording returned 32 turns and two speakers in 21.8 seconds. The role request identified Mr. Jones and Dr. Smith from clear forms of address; those passages were manually checked. Controlled tests also cover rejecting a doctor's self-introduction assigned to the patient and a name mentioned about a third party. A concern suggestion was accurate but wordy; the prompt now prefers a short symptom phrase found in the transcript. Title wording remains editable.

The first `notes-v6` request returned 16 notes in 2.4 seconds, with concise history bullets, but added “Tuesday morning” where the audio only established Tuesday. The prompt was tightened to preserve exact timing and distinguish offering assistance from agreeing to a treatment. A second request returned 14 notes in 2.2 seconds and removed the unsupported morning. Example history: “Stopped physical therapy because of work schedule, cost, distance, parking and insurance session limits.” All sections passed the notes/evidence contract and were in English. This is one recording, not a clinical accuracy benchmark; retaining an optional way to check supporting transcript passages remains useful.

The app now displays shared notes boxes and a continuous transcript, with supporting links hidden by default. These live outputs were not saved over the user's existing draft. Real Urdu and mixed English/Urdu recordings still need representative listening checks; existing controlled tests verify the translation request and evidence handling.

Final verification: 173 unit tests and all 41 production browser tests passed, along with lint, type checking, formatting and the optimized build. The browser run used empty provider keys and isolated SQLite storage, including save/restart/reopen/delete checks. The retained local draft still contains its original 35 turns, 13 notes and `notes-v3` provenance. A single read-only review identified name-attribution, duplicate-role-label and stale-title issues; each was fixed with regression coverage.

Status: The AssemblyAI/Groq workflow completed three fictional live evaluations and the user's approved five-minute MP3 on 2026-10-13. Transcript, role and note review remains necessary. Earlier Gemini investigations are retained below as historical records.

## Automatic speech detection and English output — 2026-10-14

New recordings use Universal-2 with automatic language detection and code switching. AssemblyAI requests English translation per utterance, with forced translation even when the detected primary language is English. Speaker IDs, turn IDs and timestamps are preserved. The workspace has no recording or notes language selector; new notes use `notes-v5` in English. Transcript and notes appear together on wide desktop, with tabs on smaller screens. This supersedes the controls described in the historical evaluation below; existing saved records are not rewritten.

The user's previously approved 300.19-second English MP3 completed once through the local app, without automatic retries:

| Check | Result |
| --- | --- |
| Transcription, English translation and role suggestions | HTTP 200 in 20.2 seconds; 32 turns and two speakers |
| Model/provenance | `AssemblyAI:universal-2; translation:en; Groq:openai/gpt-oss-120b`; `assemblyai-v2/english-v1/roles-v1` |
| English notes | HTTP 200 in 3.6 seconds; 15 items across five sections; schema, source-reference and digest checks passed |
| Saved user data | Neither live request saved or replaced a consultation |

Manual inspection found the heating-pad discussion and proposed Tuesday phone follow-up retained. Some wording still needs review: “Patient agreed to try yoga or tai chi classes” may be stronger than accepting help finding class options, and “confirmed appointment” is stronger than acknowledging a proposed call. Valid citations do not guarantee faithful summaries. No accuracy percentage is claimed.

Controlled Urdu/mixed turn fixtures verify that English translation replaces the source text without changing speaker attribution or timing, and missing translated turns fail safely. These fixtures do not measure real Urdu recognition or translation. Representative Urdu and mixed recordings, real Supabase installation/two-account checks and hosted Vercel execution remain pending.

Final verification: 162 unit tests, all 40 browser cases on the optimized production bundle, lint and TypeScript passed. Production checks used empty provider keys and an isolated QA database, including save/restart/reopen/delete. Desktop and mobile layouts were visually checked with no browser errors. The original local draft retained 35 turns, 13 notes and `notes-v3` provenance. One read-only review found an obsolete speaker-reason assertion and a duplicate desktop notes action; both were corrected. Native microphone checks explicitly grant browser permission and wait for workspace initialization; permission-denial and reset checks then passed three repetitions.

## Clinician workflow and language evaluation — 2026-10-13

The current workflow uses `notes-v4`, with separate recording and note language controls. New notes use clinician chart wording such as “Discussed,” “Recommended,” and “Patient reports,” with corresponding Urdu phrasing. Existing saved notes keep their original wording and provenance until explicitly regenerated. Section keys remain compatible with old records; their displayed labels are History, Discussion, Plan, Follow-up, and Preferences and barriers.

Live Groq requests reused the previously approved MP3 transcript to generate English and Urdu notes. Both responses passed schema, source-reference and digest validation. The Urdu response contained nine items across five sections and used clinician-oriented phrasing. No additional audio was uploaded for this evaluation.

Manual review found an unsupported timing detail in the Urdu follow-up: it said Tuesday morning, while source segment 33 only proposed a phone conversation early the following week, “say Tuesday.” Remove “morning” during review. A valid citation does not establish that every part of a note is supported. No clinical accuracy percentage or multilingual transcription accuracy is claimed.

Urdu and English/Urdu recording requests select Universal-2; mixed requests enable code switching. AssemblyAI documents [multilingual model support](https://www.assemblyai.com/docs/getting-started/models) and [code switching](https://support.assemblyai.com/articles/2252616939-how-does-the-api-handle-files-that-contain-spoken-audio-in-multiple-languages). Recognition and speaker separation still need representative Urdu and mixed-language recordings; output performance varies by language pair.

Supabase and Vercel integration is prepared. Local tests exercise verified-owner guards, owned audio paths, bounded uploads, job idempotency and terminal cleanup. Browser checks use controlled Supabase/provider boundaries with the actual workspace code. Installed database policies, two real accounts, auth email delivery and hosted Linux execution remain pending the user's Supabase configuration.

Verification for this change: 161 unit tests passed. The configured browser run passed 39 cases and skipped its missing-key case, which passed separately on the final production bundle with empty provider keys; all 40 browser cases were exercised. Lint, TypeScript and the optimized build passed. Production save/restart/reopen/delete checks used an isolated QA database. Hosted mode with missing Supabase configuration rejected private API requests and redirected to setup/login. The original local AI draft remains intact with 35 transcript turns, 13 notes and its `notes-v3` provenance. Desktop and mobile layouts were visually reviewed.

## Earlier submission evaluation — 2026-10-13

Provider implementation: `2df9596`, followed by the final reviewed fixes on `feat/submission-workflow`. Native HTTPS requests use AssemblyAI `/v2/upload` and `/v2/transcript`, then Groq `/openai/v1/chat/completions`. AssemblyAI selected `universal-3-pro`; Groq used `openai/gpt-oss-120b`, `roles-v1` and `notes-v3`. The original Gemini adapter remains available through explicit configuration.

Each fictional recording was generated locally with FFmpeg FLite, using distinct `awb`, `slt` and, for the third speaker, `rms` voices. Audio is mono 16 kHz PCM WAV. References, unedited output and timings are local ignored diagnostic files. The third recording includes low-volume pink noise. These are short synthetic smoke evaluations, not a benchmark of natural speech, accents, overlap or clinical accuracy. Each sample was processed once for this evaluation, without automatic generation retries; calls were spaced to respect the account's limits.

| Sample | Duration | Transcription + roles | Notes | Observed speakers / turns / notes |
| --- | ---: | ---: | ---: | --- |
| A: quiet dialogue and corrected start day | 19.22 s | 11.3 s | 1.5 s | 2 / 4 / 7 |
| B: uncertain symptoms, corrected cost and work constraints | 43.70 s | 11.8 s | 2.6 s | 2 / 8 / 9 |
| C: caregiver, tentative scheduling and background noise | 53.56 s | 12.8 s | 1.7 s | 3 / 9 / 6 |

The expected doctor and patient roles were suggested in all three recordings. In C, the caregiver remained `unknown`, the available role for someone who is neither doctor nor patient. All emitted notes passed schema and source-reference validation. That validation does not establish semantic accuracy.

Concrete observations from the reference text and unedited output:

- A preserved the correction **Tuesday, not Monday**, headache duration and after-work preference. A note added “doctor to confirm,” which was not explicitly said and should be removed during review.
- B preserved uncertainty about Monday versus Tuesday, the $25-to-$60 correction in the transcript, work/childcare constraints and the absence of a booking. Notes retained unconfirmed cost and tentative Friday 4:30 availability. “Patient believes copay is $25” weakened the spoken correction; change it to “Previously thought $25; portal now says $60, unconfirmed.”
- C distinguished all three voices and preserved that the patient had not agreed to the test and that no test had been ordered. The transcript rendered the name **Casey** as **“case he”** in one passage. A follow-up note's “finalize scheduling” was stronger than the office's stated plan to check availability and cost; retain the tentative wording.
- No speaker swap was observed in these short, sequential synthetic turns. Natural overlap, an unidentified caregiver, multilingual conversations and real human microphone-to-AI quality were not evaluated. Browser recording and server validation were exercised separately with actual MediaRecorder WebM and a controlled audio stream.

## Approved MP3 and native Firefox check

The user explicitly approved uploading “Doctor-Patient Cost of Care Conversation - trimmed.mp3” to AssemblyAI and sending the derived transcript to Groq. The recording is 300.19 seconds and approximately 6.87 MiB. It produced **35 transcript turns**, two suggested roles (doctor and patient), and **13 note items** across discussion, explanations, decisions, follow-up and context.

An isolated Firefox 157.0.1 profile using `http://127.0.0.1:3000` completed the actual UI workflow: `/api/transcribe` **200**, `/api/notes` **200**, and `/api/consultations` **201**. No browser network failure or application alert occurred. The text was saved locally as **Cost-of-care recording — AI draft**. A separate direct transcription check completed in 15.4 seconds. This recording has no independently verified reference transcript, so no accuracy percentage is reported.

The draft captured recurring back pain, work/travel/parking costs, limited therapy coverage, alternative options and the proposed Tuesday phone follow-up. Manual review found a missing heating-pad recommendation and an insurance-cost statement summarized too broadly as therapy coverage. A statement of interest in alternatives should also be checked before interpreting it as agreement to treatment. The saved record is an AI draft, not a clinically reviewed record.

During provider selection, `openai/gpt-oss-20b` intermittently failed structured-output validation on the longer text. The configured 120B model completed the recorded evaluations. No automatic switch or retry was introduced. Account limits and service availability can still interrupt future requests.

## Release verification

- 141 unit tests passed, covering provider contracts, bounded audio, failures, deadlines, evidence, real temporary SQLite storage and Markdown.
- The complete browser suite passed 32 cases, with its missing-key case skipped because the local app was configured. That case then passed separately against a production server with all provider keys empty: all 33 browser cases were exercised successfully across those configurations.
- Lint, TypeScript and the optimized production build passed. A keyless production process loaded the prepared sample, saved text, restarted, reopened the same record, deleted it and returned 404 afterward.
- Desktop and 390-pixel mobile screens were inspected; mobile document width was 390 pixels with no horizontal overflow. Source navigation, focused-edit protection, cancellation, failed-save retention and sample labeling have browser regressions.
- GitHub Actions is configured with Node 24, FFmpeg and the same checks. Hosted CI has not run because this repository has not been pushed.

Demonstrate the live path when services respond. **Load sample consultation** provides a visibly labeled, editable fictional example without cloud calls; it demonstrates review, persistence and export rather than new transcription.

## Historical Gemini protocol and investigation

The following protocol and results describe the earlier Gemini implementation at the commits named in each record. Statements about unavailable or unverified generation below refer to that implementation, not the current AssemblyAI/Groq release.

## Purpose

Measure whether ConsultNote captures the words, speakers, roles, and discussion accurately enough for a fictional interview demonstration. Software tests verify application behavior; this protocol evaluates the AI output.

## Sample set

Create short recordings with consenting volunteers acting fictional roles. Keep a reference transcript and expected note points for each. Store only approved fictional fixtures in `tests/fixtures/audio/` once implementation starts.

| Sample | Conversation | What it checks |
| --- | --- | --- |
| A: clear dialogue | Two speakers, 1-2 minutes, explicit doctor/patient introductions, a concern and agreed follow-up | Basic transcription, roles, decisions, and evidence |
| B: context and uncertainty | Two speakers, 2-3 minutes, an uncertain statement, a correction, and nonmedical context such as work or transport | Coverage, corrected facts, uncertainty, and omitted versus invented details |
| C: difficult attribution | Two speakers, 1-2 minutes, brief interruptions/background noise and no explicit introductions | Speaker swaps, role inference, and clear handling of ambiguity |

Add a silent clip for a functional no-speech check. Add a third-speaker sample before claiming support beyond the two-person demonstration. Evaluate mixed languages separately before advertising that capability.

## Run record

For each attempt, record:

- Date, sample ID, audio duration, language, and recording conditions.
- Exact model ID, SDK version/API endpoint, prompt version, and application commit.
- Processing time for transcription and notes independently.
- Unedited provider result and the reviewer-corrected result, clearly distinguished.
- Wrong/missing words, speaker swaps, incorrect role assignments, and incomplete passages.
- Expected note points omitted, unsupported details added, and incorrect evidence links.
- Provider errors or quotas, user corrections required, and repeat-run variability.

When a reference transcript exists, calculate word error rate as `(substitutions + deletions + insertions) / reference word count`; document tokenization and normalization. Without one, report concrete observed errors rather than an accuracy percentage. Speaker/role review can use manually checked segment counts; do not label that a formal diarization-error-rate benchmark.

## Demonstration readiness

- [ ] At least three fictional samples processed and inspected end to end.
- [ ] A new microphone recording and an uploaded recording both complete the workflow.
- [ ] Critical facts, corrections, uncertainty, and explicit next steps checked against the audio.
- [ ] Speaker and doctor/patient errors identified and correctable in the interface.
- [ ] Each note item has a valid source link; reviewers have also checked whether the cited text supports it.
- [ ] Save/reopen/export verified, including after an application restart.
- [ ] A quota/network failure preserves the current draft and offers manual retry.
- [ ] A saved fictional example is available and visibly labeled for fallback demonstration.

Readiness means known behavior on the evaluated samples. It does not establish clinical suitability or general accuracy across languages, accents, or recording conditions.

## Interview explanation

Explain why the project uses browser capture, a server-side Gemini integration, schema/reference validation, human review, and SQLite. Discuss the difference between speaker distinction and doctor/patient inference. Show a measured failure and its correction, along with the working workflow.

## Results

2026-10-13 implementation record:

| Field | Value |
| --- | --- |
| Configured model | `gemini-3.8-flash` |
| SDK | `@google/genai` 2.29.0 |
| API | `client.interactions.create`, `POST https://generativelanguage.googleapis.com/v1beta/interactions` |
| Prompt version | `transcribe-v1` |
| Output budget / deadline | 16,384 tokens / 120 seconds per generation |
| Request policy | Inline audio, JSON schema, `store: false`, no tools, no retries or continuation |
| Contract verification | Real SDK serialization and error handling tested against controlled HTTP responses; browser speaker/text review and manual retry tested |
| Live sample / latency / raw output | Not run / not measured / none; key unavailable |
| Unverified | Account/model access, actual audio MIME and schema acceptance, full-recording coverage, speaker accuracy, role quality and live completion behavior |

The tests are application checks, not model-quality measurements. Once a free-tier key is configured, run short fictional sample A in the app and record the exact application commit, latency and unedited/corrected output here. Follow with samples B and C before claiming demonstration readiness. Sources checked: Google's [audio guide](https://ai.google.dev/gemini-api/docs/audio), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) and [Interactions reference](https://ai.google.dev/api/interactions-api).

### 2026-10-13 live connectivity check

| Field | Observation |
| --- | --- |
| Application commit / SDK / prompt | `8ad5cfa` / `@google/genai` 2.29.0 / `transcribe-v1` |
| Model | `gemini-3.8-flash`; kept unchanged |
| Key configuration | Read by the restarted app from its ignored local environment file; no credentials recorded |
| Model-list check | `GET /v1beta/models` returned HTTP 200 and included the configured model |
| Sample | Synthetic smoke dialogue, two FLite voices (`awb` and `slt`), 19.22 seconds, mono 16 kHz PCM WAV, 615,118 bytes |
| Reference content | Doctor Morgan introduces their role; patient Alex describes two days of mild headaches, requests an appointment after work, agrees Friday afternoon and corrects the start date to Tuesday rather than Monday |
| App request | `POST /api/transcribe` returned `AI_UNAVAILABLE` (HTTP 503) in 3.5 seconds |
| Direct SDK diagnostic | Same audio, model, prompt and JSON schema returned provider `InternalServerError` with HTTP 503 in 2.8 seconds |
| Transcript / accuracy / corrections | No transcript produced; not measurable |

The key was accepted for model listing. This does not establish successful generation or audio/schema compatibility. Both generation attempts disabled automatic retries. Local synthetic audio, reference and safe diagnostic results are kept in ignored `.superpowers/live-transcription-2026-10-13/`; no recording or key was committed. Retry the app manually later before evaluating samples A–C or claiming live quality.

### 2026-10-13 service-error diagnosis

After the user encountered `AI_UNAVAILABLE`, one further direct SDK request at application commit `8630ed8` used the same 19.22-second fictional sample, model, SDK, prompt and schema. Google returned HTTP 503 in 4.8 seconds. Safe inspection of the nested provider error identified high demand and temporary unavailability; no raw error body or credential was recorded.

This reproduces the service failure independently of the user's five-minute MP3. It does not establish successful generation or audio/schema compatibility. The application now distinguishes an explicit provider 503 from its generic connection/model failure message and suggests manual retry. A controlled real-SDK transport regression verifies the public message, hides provider details and confirms a single request. The configured model, request parameters and no-retry policy are unchanged. Google's [troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting) describes HTTP 503 as temporary service unavailability.

### 2026-10-13 Firefox, timeout and compatibility investigation

At application commit `28bf1db`, the user reported a 503 followed by an app HTTP 200 in 23.4 seconds with a Firefox `NetworkError`. Subsequent screenshots showed HTTP 504 after 120,125 ms and HTTP 503 after 8,020 ms. The 504 matches the configured 120-second generation deadline. The screenshots show Firefox receiving these error responses; they do not explain the earlier interrupted successful response.

An isolated Firefox 157.0.1 profile at `http://127.0.0.1:3000` received complete 503 JSON responses for both the 19.22-second fictional sample and the user's trimmed 300.19-second MP3. A separate controlled browser check supplied a 503 followed by a 200 after 23.4 seconds: Firefox read both bodies and rendered all four fixture segments. These controlled responses verify the browser review path, not live Gemini output or the cause of the user's earlier network error.

| Live request | Result |
| --- | --- |
| `gemini-3.5-flash-lite`, Interactions, 19.22-second fictional WAV | Completed in 39.5 seconds; valid schema/references/timestamps, two speakers, four segments |
| `gemini-3.5-flash-lite`, Interactions, user's 300.19-second MP3 | HTTP 503 in 9.4 seconds; provider high demand |
| `gemini-3.8-flash`, GenerateContent, same MP3 and prompt/schema | HTTP 503 in 17.8 seconds; provider high demand |

The successful Flash-Lite sample preserved the two roles and most words, but changed the patient's correction from **Tuesday** to **today**. Human correction is required; this is not evidence of clinical accuracy. The alternative model supports audio and has a documented [free tier](https://ai.google.dev/gemini-api/docs/pricing), but its failed full-length check does not justify presenting a model switch as a reliable fix. The [GenerateContent comparison](https://ai.google.dev/api/generate-content) used a single request with retries and automatic continuation disabled. Application configuration and code were not changed during this investigation; the model remains `gemini-3.8-flash`. Full-length live transcription and the earlier browser delivery failure remain unverified. Diagnostics and the short fictional model output remain local and ignored by Git.
