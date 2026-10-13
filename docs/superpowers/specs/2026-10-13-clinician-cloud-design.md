# Clinician workflow and cloud preparation

Approved scope: prioritize English and Urdu, write clinician chart notes, simplify the consultation workflow, and prepare Supabase/Vercel integration. Supabase will be configured later. Keep the development branch open for testing.

2026-10-14 update: the user's later request supersedes the language selectors and single-panel desktop layout below. Automatically detect speech, translate each speaker turn into English, and generate English notes only. Show transcript and notes together on wide desktop, retaining tabs on smaller screens. Existing saved text and provenance remain unchanged until explicitly regenerated.

## Clinical workflow

Record or upload → review words and speaker roles → generate and review notes → save/export. Keep one primary action at each stage. Reuse the existing editable transcript, source citations, history, sample, and draft protection. Use subtle transitions and respect reduced motion.

Notes use concise chart language: patient-reported history, clinician discussion, agreed plan, follow-up, and preferences/barriers. Preserve corrections, negations, uncertainty, attribution and action owners. Never invent findings, diagnoses or agreement. Keep existing stored section keys compatible. Notes default to English; offer Urdu and original conversation language. Transcript text remains in its spoken language and displays bidirectional text correctly.

Audio language choices: automatic, English, Urdu, mixed English/Urdu. Urdu and mixed recordings explicitly use AssemblyAI Universal-2 and its code-switching option where applicable. Actual Urdu recognition quality remains unverified without a test recording. AssemblyAI transcription plus Groq roles/notes remains the default; Gemini is explicit only.

## Cloud boundary

Local mode retains SQLite and existing drafts. Supabase mode uses verified authentication, owner-scoped Postgres records, and private audio Storage. Hosted Vercel mode must fail closed when Supabase is absent. No provider credentials reach the browser.

Browser uploads go directly to private Storage because recordings can exceed Vercel's 4.5 MB request limit. Small JSON requests validate the stored recording, submit one transcription job, and poll its existing provider ID. No long provider polling loop inside a cloud request. Cloud processing has owner checks and atomic per-user usage limits. Audio is temporary and removed on terminal processing outcomes; setup documents stale-file cleanup.

Prepare email/password authentication, confirmation callback, sign-out, database SQL, and deployment instructions. Do not create accounts, deploy, or claim live cloud verification without credentials. Explain free plan constraints, including AssemblyAI's trial credits and Supabase email restrictions.

## Constraints

- Preserve the existing user's SQLite database and saved AI draft.
- Next.js 16.4, React 19, Node.js 24; use bundled Next documentation.
- Keep source citations, digest validation and saved provider provenance.
- Do not merge, push, deploy, or use the finishing skill.
- English and Urdu are the prioritized languages.
