# Supabase and Vercel setup

The local app works now with SQLite. Cloud integration is prepared; Supabase authentication, policies, Storage and live Vercel execution still need verification after you configure your project. Existing local drafts stay in SQLite and are not automatically uploaded.

## 1. Create the free Supabase project

1. Create a project at [Supabase](https://supabase.com/dashboard). Keep the database password private.
2. Run [supabase/schema.sql](../supabase/schema.sql) once in the SQL editor. It creates owner-scoped consultations, private audio Storage, transcription jobs and server-only processing limits.
3. Copy the project URL, publishable key and legacy service-role key from project Settings → API/API Keys into the ignored `.env` or `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
   TRANSCRIPTION_PROVIDER=assemblyai
   ASSEMBLYAI_API_KEY=your-assemblyai-key
   GROQ_API_KEY=your-groq-key
   GROQ_MODEL=openai/gpt-oss-120b
   ```

   Keep the service-role and provider keys server-only. No service-role key belongs in browser code or Git.
4. Under Authentication → URL Configuration, set the local Site URL to `http://127.0.0.1:3000`. Add `http://127.0.0.1:3000/auth/callback` as an allowed redirect. Restart the app.
5. Create an account at `/login`, confirm it, and sign in. The app uses email and password; logout is in the header.

Supabase's default email sender is restricted: it sends only to project-team addresses and has a low hourly limit. For a private interview demo, you can disable email confirmation in the provider settings or create confirmed test users in the dashboard. For public signups with confirmation, configure a custom SMTP sender. Never present disabled confirmation as verified email ownership. See [Supabase email setup](https://supabase.com/docs/guides/auth/auth-smtp).

## 2. Verify cloud mode locally

- Account A: upload the five-minute recording, transcribe, review roles, generate/edit notes and save. The browser should upload the file directly to Supabase Storage; `/api/audio/validate` and `/api/transcribe/jobs` receive small JSON bodies.
- Sign out, then sign in as account B. A's history must be absent. Direct record and job requests for A's IDs must return 404. Supabase Storage must reject B reading A's private object.
- Check the `consultations` table for owner IDs and the `transcription_jobs` table for one provider ID per submission.
- Cancel waiting, then press transcribe again: the app resumes the same pending job. A failed or expired job needs a new recording submission.
- Uploaded audio is removed after completion, explicit cancellation or terminal failure. Closing the tab can leave an abandoned private file. For this demo, remove files older than 24 hours through the Storage dashboard; do not delete only `storage.objects` metadata with SQL. Provider retention is separate from Supabase deletion.

Processing limits: 10 transcription starts and 20 notes requests per account per database day, plus 100 operations per day across the demo. Only one recent transcription job can run per account. A pending job expires after 15 minutes; polling uses its existing provider ID. These limits bound app usage and do not replace provider rate limits. Groq quota errors are surfaced without automatic regeneration.

## 3. Deploy on Vercel Hobby

1. Import your repository into [Vercel](https://vercel.com/new) when you are ready. Choose the `consultnote` project directory and the Next.js preset.
2. Use Node.js **24.x**. Build command: `npm run build`. Keep provider and Supabase secrets in Vercel's environment settings, with the same names shown above. Add them before building; `NEXT_PUBLIC_*` variables are embedded at build time.
3. Add `https://your-app.vercel.app/auth/callback` to Supabase's allowed redirects. Set the production Site URL to `https://your-app.vercel.app`. Add each preview URL explicitly if testing authentication there.
4. Deploy and repeat the two-account checks above, including microphone recording over HTTPS, the full-size MP3 upload, polling, saved-record reopening and Markdown export.

Vercel mode refuses to process data without Supabase configuration. It never falls back to anonymous SQLite in a hosted deployment. SQLite is retained only for local development.

Recordings bypass Vercel's [4.5 MB function payload limit](https://vercel.com/docs/functions/limitations) through direct private Storage uploads. Audio validation uses a traced Linux x64 `ffprobe` binary and temporary scratch files, which are removed after inspection. Cloud transcription submits once and polls in short requests; completion adds role suggestions within a bounded request. Notes are generated from reviewed text in a separate request.

Vercel Hobby suits this personal interview project; its [usage terms](https://vercel.com/docs/plans/hobby) restrict it to personal, noncommercial use. Supabase's [free limits](https://supabase.com/pricing) include 500 MB database space and 1 GB file storage, and inactive projects can pause. AssemblyAI uses [trial credits](https://support.assemblyai.com/articles/5370767329-can-i-sign-up-for-free), so the complete AI pipeline is not free indefinitely.

## English and Urdu

Recording language is detected automatically. English, Urdu and mixed speech use Universal-2 with its [code-switching option](https://www.assemblyai.com/docs/pre-recorded-audio/code-switching). AssemblyAI's [translation](https://www.assemblyai.com/docs/speech-understanding/translation) returns English for each speaker turn while preserving its timestamps. New transcripts, role explanations and notes are written in English; no language selectors are shown. Existing saved text remains unchanged until explicitly regenerated.

The approved English MP3 completed transcription with English translation and English notes on 2026-10-14. Actual Urdu and mixed speech recognition, translation and speaker separation remain unverified until representative recordings are available. Translation uses AssemblyAI trial credits. Review words, speaker roles, medical names, numbers and translated notes before saving.

## Configuration troubleshooting

- Cloud setup pending: add both public Supabase variables and restart/redeploy.
- Cloud processing needs server key: add `SUPABASE_SERVICE_ROLE_KEY`, keeping it private.
- Database setup error: run the SQL once and confirm the three tables and RPCs exist.
- Upload rejected: check the private bucket, policies, file size and supported file format.
- Sign-in/confirmation failure: check redirects, email confirmation and SMTP setup.
- Provider quota/busy error: the draft remains available. Resume a pending job instead of creating duplicate transcriptions.

Current automated checks validate local workflows and mocked cloud boundaries. They do not prove the policies are installed correctly in your Supabase account or that Vercel tracing executes successfully in production; the cloud verification steps above are required after setup.
