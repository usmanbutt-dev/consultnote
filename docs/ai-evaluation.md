# AI evaluation and interview demonstration

Status: Transcription and speaker review pass controlled-response checks. A configured key was accepted by the model-list endpoint on 2026-10-13, but the first live transcription attempts returned HTTP 503. No live transcript or quality measurement is available yet.

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
