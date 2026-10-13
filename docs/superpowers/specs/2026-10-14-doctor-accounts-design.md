# Doctor accounts and profile menu

The user requested complete doctor self-service accounts, a profile-picture menu in place of Help, and a simpler transcript. Supabase/project/repository/Vercel configuration is explicitly deferred until the implementation is tested. Keep the current checkout and feature branch; no publication or finishing workflow.

## Account behavior

- Email/password sign up with full name, email confirmation, login, logout, forgotten-password recovery and password change.
- Private doctor profile: full name, specialty, clinic and optional photo. Email identifies the account and is displayed read-only; changing email is outside these minor profile edits.
- Initials when no photo exists. An unsigned local preview shows an account icon and sign-in entry without fabricating a doctor.
- Avatar menu links to My profile and Sign out. Navigation and logout protect unsaved consultation edits.
- Profile deletion means deleting the Auth account, private profile, owned consultations/jobs/usage and owned audio/avatar objects. Require the current password and typed DELETE confirmation. Never accept a target user ID from the browser.
- Deletion first marks the account inactive, blocks new work, cancels active jobs, removes owned storage through the Storage API, then deletes the Auth user. Partial cleanup remains retryable; failures must not claim successful deletion.

## Storage and authorization

Reuse Supabase SSR clients, verified `getUser()` checks and owner-scoped consultation storage. Add private `doctor_profiles`, a sign-up trigger/backfill, and a private `doctor-avatars` bucket. RLS permits only the owner's profile and active account's consultation/audio access. Profile photo uploads accept bounded JPEG/PNG/WebP with verified signatures; SVG and arbitrary avatar URLs are rejected. Server-only admin operations always derive the owner from verified authentication.

Prefer `SUPABASE_SECRET_KEY`, retaining compatibility with the existing legacy `SUPABASE_SERVICE_ROLE_KEY`. No server key may reach browser code. All account mutations require same-origin requests and bounded input. Credentials, photos and account rows stay out of Git. SQL installation and real two-account policy verification happen during the later CLI setup.

## Speaker display

Remove the permanent Speakers block. Render the existing doctor/patient/unknown labels and names supported by the recording. Keep manual role correction inside an optional Correct speaker labels disclosure, because an account login does not identify voices in uploaded recordings. Display the account doctor's name in the profile menu; do not assign it to an unrelated recorded speaker. Preserve unknown roles, evidence, stale-notes confirmation, title invalidation and source digest behavior.

## Verification

Use failing tests first for authenticated owner boundaries, account CRUD validation, wrong-password deletion, cleanup failure/retry, photo validation and safe redirects. Browser checks cover the local avatar menu, optional role corrections, unsaved-edit protection and account forms with controlled responses. Run unit tests, lint, types, build and the complete isolated production browser suite. Verify existing local saved data remains available. Report live Supabase email/RLS/storage checks as deferred, not completed.
