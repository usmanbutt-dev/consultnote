# ConsultNote

AI-assisted doctor–patient conversation notes with transcript evidence and human review.

**Implemented:** microphone/upload, automatic English/Urdu/mixed input with English transcript and notes, speaker review, clinician chart notes with editable sources, history, rename/delete and PDF, plain-text or Markdown downloads. One **Create notes** action processes audio into a draft. Notes appear first; **View conversation** opens the transcript alongside them on wide desktop screens or switches views on smaller screens. AssemblyAI/Groq is the default processing path. Supabase accounts/private storage and Vercel background processing are prepared for configuration. A clearly labeled sample works without external APIs.

## Run locally

Install Node.js 24 LTS. Audio inspection uses a bundled `ffprobe`; no separate FFmpeg installation is needed. From this directory:

```powershell
npm ci
npm run dev
```

Open [ConsultNote](http://127.0.0.1:3000). Select **Try a sample conversation** to explore immediately without keys. For new audio processing, configure the providers below.

## Configuration

On a new checkout, copy [.env.example](.env.example) to `.env.local`, set the keys and restart the app:

```dotenv
ASSEMBLYAI_API_KEY=your_key
GROQ_API_KEY=your_key
TRANSCRIPTION_PROVIDER=assemblyai
GROQ_MODEL=openai/gpt-oss-120b
DATABASE_PATH=.data/consultnote.sqlite
```

AssemblyAI offers [trial credits](https://support.assemblyai.com/articles/5370767329-can-i-sign-up-for-free); Groq offers a [free plan with limits](https://console.groq.com/docs/rate-limits). Access and remaining quota depend on the account. The app does not enable billing. Keep provider credentials server-side and out of Git; never prefix them with `NEXT_PUBLIC_`.

For accounts, online storage and hosting, follow [Supabase and Vercel setup](docs/deployment.md). Leaving Supabase unset keeps local SQLite mode. On Vercel, missing cloud configuration blocks access instead of enabling local anonymous processing.

The original Gemini adapter remains available with `TRANSCRIPTION_PROVIDER=gemini`, `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.8-flash`. There is no automatic provider/model substitution after a failed request. Gemini overload diagnostics and the replacement's live checks are documented in [AI evaluation](docs/ai-evaluation.md).

## Workflow

1. Record or upload an MP3, WAV, WebM or OGG file, then play it back. Speakers may use English, Urdu or a mixture; there is no language selector.
2. Select **Create notes**. The app reads the conversation and prepares a draft in one flow, with a visible progress message and Cancel. If notes fail, retry reuses the completed transcript.
3. Review the English notes in their editable bullet sections. **View conversation** reveals the continuous transcript and doctor/patient/unknown role controls. Names appear only when clearly introduced or addressed. Expand **See in conversation** to inspect supporting passages; selecting one reveals and focuses the matching text.
4. Review the suggested **Patient – Issue – Date** title and select **Save consultation**, then **Download notes**. Choose a formatted PDF, plain text, or Markdown. PDF and text contain the notes; Markdown also includes the conversation and source links. Filenames follow the saved title, preserving readable words, spaces and accents while removing unsupported filename characters. Reopen from history, rename or delete as needed. The date is the current consultation session date; missing names or issues use generic labels. Your custom titles are preserved.

Existing drafts keep their wording. Select **Regenerate notes** for shorter bullets; newly transcribed audio can include spoken names and a suggested title.

Audio must be at most 10 MiB and 10 minutes. Recording stops at 9:59 to leave encoding headroom. The server independently validates the actual signature, audio stream and duration; WebM without duration metadata uses packet timing. Multipart parsing is bounded to 11 MiB, JSON requests to 1 MiB, and each audio probe to 15 seconds.

AssemblyAI receives audio and performs per-speaker English translation; Groq receives the English transcript for roles and notes. Translation consumes AssemblyAI trial credits alongside transcription. Local inspection files are removed afterward. Local recordings remain in browser memory and are absent from SQLite. Cloud recordings upload directly to private Supabase Storage and are removed after terminal processing outcomes; abandoned files need cleanup as described in the deployment guide. Provider-side retention is separate.

Local transcription and notes have 120-second deadlines without automatic generation retries. Cloud transcription uses short requests against a persisted job, avoiding Vercel payload and long-request limits. AssemblyAI polling retrieves one existing job. Optional role inference has a 15-second budget; failure preserves the transcript with unknown roles. Groq uses strict JSON schemas, 1,024 output tokens for roles and 4,096 for notes.

Changing transcript text or roles asks before discarding notes. A server-computed SHA-256 digest rejects stale notes on save. Failed requests preserve the draft; cancelled/replaced results are ignored. Saved consultations contain text only. Export becomes available after saving the current edits.

Downloads are generated locally in the browser without sending notes to another service. The PDF generator and its embedded fonts load only when PDF is selected. PDF files use selectable text, section headings, bullet points, automatic page breaks and page numbers. The last-saved date is labeled separately from any consultation date in the title.

PDF supports the app's English output. If manually edited text uses characters absent from the embedded font, the app explains the limitation and offers plain text or Markdown to preserve them.

**Try a sample conversation** loads prepared fictional text and notes, clearly labeled in the interface and download. It works without external APIs and never claims to have transcribed the user's recording.

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

One Next.js App Router application uses TypeScript, Tailwind, Zod, native browser audio APIs and Node 24's built-in SQLite locally. Optional Supabase mode uses verified authentication, owner-scoped Postgres and private audio Storage. Provider calls and secrets stay in server-only modules. A production build needs no existing database.

- [Five-minute demonstration and submission guide](docs/demo.md)
- [Product design](docs/superpowers/specs/2026-10-13-consultnote-design.md)
- [Implementation plan](docs/superpowers/plans/2026-10-13-consultnote.md)
- [Measured AI behavior and limitations](docs/ai-evaluation.md)
- [Implementation decisions and tradeoffs](docs/implementation-decisions.md)
- [Supabase and Vercel setup](docs/deployment.md)
- [Clinician/cloud design](docs/superpowers/specs/2026-10-13-clinician-cloud-design.md)

Source IDs are validated; factual accuracy still requires review against audio. Models can misattribute statements, infer unsupported agreement, omit context or swap speakers. This remains a fictional-data interview demonstration. Cloud integration is prepared, but live two-account isolation and hosted execution must be checked after Supabase setup. Urdu speech quality also needs a representative recording.

The repository remains local. Keys, recordings, SQLite data and diagnostic artifacts are Git-ignored. Include source, tests, documentation, `.env.example` and `package-lock.json` in a submission; exclude actual environment files and local data.
