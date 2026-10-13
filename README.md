# ConsultNote

AI-assisted doctor–patient conversation notes with transcript evidence and human review.

**Implemented:** microphone/upload, speaker review, editable source-linked notes, SQLite history, rename/delete and Markdown export. AssemblyAI/Groq is the default processing path. An explicit prepared sample supports demonstrations without external APIs.

## Run locally

Install Node.js 24 LTS and [FFmpeg](https://ffmpeg.org/download.html). Ensure `ffprobe` is on PATH. From this directory:

```powershell
npm ci
npm run dev
```

Open [ConsultNote](http://127.0.0.1:3000). Select **Load sample consultation** to explore immediately without keys. For new audio processing, configure the providers below.

## Configuration

On a new checkout, copy [.env.example](.env.example) to `.env.local`, set the keys and restart the app:

```dotenv
ASSEMBLYAI_API_KEY=your_key
GROQ_API_KEY=your_key
TRANSCRIPTION_PROVIDER=assemblyai
GROQ_MODEL=openai/gpt-oss-120b
DATABASE_PATH=.data/consultnote.sqlite
```

AssemblyAI offers [trial credits](https://support.assemblyai.com/articles/5370767329-can-i-sign-up-for-free); Groq offers a [free plan with limits](https://console.groq.com/docs/rate-limits). Access and remaining quota depend on the account. The app does not enable billing. Keep credentials server-side and out of Git; never use a `NEXT_PUBLIC_` key.

The original Gemini adapter remains available with `TRANSCRIPTION_PROVIDER=gemini`, `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.8-flash`. There is no automatic provider/model substitution after a failed request. Gemini overload diagnostics and the replacement's live checks are documented in [AI evaluation](docs/ai-evaluation.md).

## Workflow

1. Record or upload an MP3, WAV, WebM or OGG file, then play it back.
2. Select **Transcribe audio**. Review every segment and suggested doctor/patient/unknown role.
3. Select **Generate notes**. Edit note text and use source buttons to focus its transcript evidence.
4. Enter a title, save, reopen from history, rename or delete, and export Markdown.

Audio must be at most 10 MiB and 10 minutes. Recording stops at 9:59 to leave encoding headroom. The server independently validates the actual signature, audio stream and duration; WebM without duration metadata uses packet timing. Multipart parsing is bounded to 11 MiB, JSON requests to 1 MiB, and each audio probe to 15 seconds.

AssemblyAI receives audio; Groq receives transcript text. Local inspection files are removed afterward. Recordings remain in browser memory for the current draft and are absent from SQLite. Provider-side storage/retention is separate and follows each service's terms.

Each processing action has a 120-second deadline and no automatic generation retries. AssemblyAI polling retrieves one existing job. Optional role inference has a 15-second budget; failure preserves the actual transcript with unknown roles. Groq uses strict JSON schemas, 1,024 output tokens for roles and 4,096 for notes.

Changing transcript text or roles asks before discarding notes. A server-computed SHA-256 digest rejects stale notes on save. Failed requests preserve the draft; cancelled/replaced results are ignored. Saved consultations contain text only. Export becomes available after saving the current edits.

**Load sample consultation** loads prepared fictional text and notes, clearly labeled in the interface and export. It works without external APIs and never claims to have transcribed the user's recording.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Unit tests exercise contracts, evidence, bounded audio, provider failures/deadlines, real temporary SQLite databases and Markdown. Browser tests cover capture, review, notes, source navigation, save/reopen/export, cancellation, draft protection and mobile layouts. Automated tests use controlled AI responses and make no live provider calls.

Browser tests use Microsoft Edge on Windows and Chromium elsewhere. Install Chromium with `npx playwright install chromium` when needed. Stop an existing development server before the standard browser suite: it starts its own server on port 3100, and Next.js permits one development server per checkout. CI runs the same checks with Node 24 and FFmpeg.

## Architecture and documents

One Next.js App Router application uses TypeScript, Tailwind, Zod, native browser audio APIs and Node 24's built-in SQLite. Provider calls and credentials stay in server-only modules. Persistence uses prepared statements and initializes lazily at runtime; a production build needs no existing database.

- [Five-minute demonstration and submission guide](docs/demo.md)
- [Product design](docs/superpowers/specs/2026-10-13-consultnote-design.md)
- [Implementation plan](docs/superpowers/plans/2026-10-13-consultnote.md)
- [Measured AI behavior and limitations](docs/ai-evaluation.md)

Source IDs are validated; factual accuracy still requires review against the audio. Models can misattribute statements, infer unsupported agreement, omit context or swap speakers. This is a fictional-data, single-user localhost interview demonstration, with no clinical-readiness claim. Public deployment and access control are separate work.

The repository remains local. Keys, recordings, SQLite data and diagnostic artifacts are Git-ignored. Include source, tests, documentation, `.env.example` and `package-lock.json` in a submission; exclude actual environment files and local data.
