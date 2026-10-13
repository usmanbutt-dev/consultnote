# Supabase and Vercel setup

The live demo is [consultnote.vercel.app](https://consultnote.vercel.app), deployed to Vercel Hobby from the private [GitHub repository](https://github.com/usmanbutt-dev/consultnote). Supabase project `ddufzrnfobkawrfvdkec` (`consultnote`, Mumbai) is in the user's confirmed Free organization; both migrations are applied. The sections below describe reproducible setup and verification. Existing local drafts stay in SQLite and are not automatically uploaded.

Signup is immediate by the user's choice for this fictional-data interview demo. Email ownership is not verified. Signed-in password changes are available; public password-reset email delivery remains pending until custom SMTP is configured. Production login and recovery callback URLs are registered alongside the local callbacks in `supabase/config.toml`.

CLI versions used: Supabase 2.120.0 and Vercel 64.0.2. Supabase's API-key listing masks secret keys by default; retrieve the full server key with `supabase projects api-keys --reveal` into a private local file or pipe, never terminal logs or Git. Provider/server keys are stored as Vercel secrets for Production and Preview. `.vercelignore` excludes environment files, local databases, recordings and diagnostic output from CLI uploads.

Live checks passed for signup/session, profile/photo CRUD, password changes, sign-out/login, cloud saving and PDF download, direct audio upload with Linux validation, two-account database/Storage isolation and password-confirmed deletion with owned-file cleanup. A separate hosted check processed the previously approved five-minute English MP3 through transcription and notes in 29.4 seconds, produced 32 transcript turns and verified saving/reopening. Disposable QA accounts/files were removed. Urdu/mixed speech quality and deferred SMTP still require separate checks.

## 1. Create the free Supabase project

1. Create a project at [Supabase](https://supabase.com/dashboard). Keep the database password private.
2. Initialize/link the Supabase CLI when proceeding with setup, then apply [the initial schema](../supabase/migrations/20261013000100_initial.sql) and [doctor accounts](../supabase/migrations/20261014000100_doctor_accounts.sql) in timestamp order using `supabase db push`. They create private consultations, profiles, photo/audio Storage, jobs and server-only processing limits. On a project that already ran the former `schema.sql`, reconcile migration history before pushing the initial migration; do not reapply its policies blindly. See [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations).
3. Copy the project URL and publishable key from Connect, and a secret key from Settings → API Keys, into the ignored `.env` or `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_SECRET_KEY=your-server-only-secret-key
   TRANSCRIPTION_PROVIDER=assemblyai
   ASSEMBLYAI_API_KEY=your-assemblyai-key
   GROQ_API_KEY=your-groq-key
   GROQ_MODEL=openai/gpt-oss-120b
   ```

   Keep secret/provider keys server-only. The old `SUPABASE_SERVICE_ROLE_KEY` name remains supported as a fallback; a configured modern secret takes priority. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
4. Under Authentication → URL Configuration, set the local Site URL to `http://127.0.0.1:3000` and allow `http://127.0.0.1:3000/**` for local callbacks and password recovery. Use explicit hosted origins later. Restart the app.
5. Create an account at `/login` with name, email and password, confirm it, and sign in. The avatar menu opens My profile and Sign out. Forgotten-password emails return through the callback to `/reset-password`.

Supabase's default email sender is restricted: it sends only to project-team addresses and has a low hourly limit. For a private interview demo, you can disable email confirmation in the provider settings or create confirmed test users in the dashboard. For public signups with confirmation, configure a custom SMTP sender. Never present disabled confirmation as verified email ownership. See [Supabase email setup](https://supabase.com/docs/guides/auth/auth-smtp).

## 2. Verify cloud mode locally

- Create/confirm a doctor account, sign in, edit name/specialty/clinic and reload. Upload/replace/remove a small JPG, PNG or WebP photo; verify initials when absent and verify another account cannot read the private photo. Email is displayed read-only; password changes use a separate screen.
- Test forgotten-password recovery and an expired callback. Supabase email delivery/SMTP and redirect allowlists must work before claiming these flows are live.
- Using a disposable account, save a fictional consultation and upload a photo. Delete with wrong password first: data must remain. Then enter the correct password and DELETE: Auth, profile, consultations, jobs/usage and owned Storage objects must disappear. The login page should confirm removal; old credentials/tokens must no longer access data. If cleanup fails, retry deletion from My profile rather than claiming success.
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
- Cloud processing needs server key: add `SUPABASE_SECRET_KEY` (or the supported legacy name), keeping it private.
- Database setup error: apply both versioned migrations and confirm `doctor_profiles`, consultations, jobs, usage, Storage policies and RPCs exist.
- Upload rejected: check the private bucket, policies, file size and supported file format.
- Sign-in/confirmation failure: check redirects, email confirmation and SMTP setup.
- Provider quota/busy error: the draft remains available. Resume a pending job instead of creating duplicate transcriptions.

Automated suites validate local workflows and controlled cloud boundaries. Separate live checks on this deployment verified installed two-account RLS/Storage isolation, account CRUD/deletion, Vercel's Linux audio inspection and the approved English MP3's transcription/notes/save/reopen flow. Repeat the cloud checks above after changing migrations or hosting settings; SMTP and actual Urdu/mixed recordings remain pending.
