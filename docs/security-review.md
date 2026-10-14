# Security review — 2026-10-14

Focused review of the fictional-data interview demo at [consultnote.vercel.app](https://consultnote.vercel.app). Application changes are in commits `7881059` and `3fd93c2`; all five database migrations are applied. Tests used disposable accounts and tiny fixture files, with no live AI calls. This is a bounded security review, not a formal penetration test or certification for patient data.

## Changes

- **Browser protection:** fresh CSP nonces for server-rendered scripts, restricted backend connections, blocked framing and embedded objects, `nosniff`, no referrer and scoped microphone permission. App responses use private, no-store caching. The proxy preserves refreshed authentication cookies. Production allows neither inline scripts without a nonce nor runtime evaluation; development retains the evaluation required by Next tooling. See [Next CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy).
- **Request boundaries:** reject mismatched/null origins and cross-site or same-site browser API requests, including job polling that can finalize processing. Hosted mutations require an Origin header. Local browser hosts must use loopback, preventing an attacker-controlled hostname from reaching local processing through DNS rebinding.
- **Validation:** configure the shared consultation and account schemas with `jitless` before creating them. This removes optional runtime code-generation probes while keeping validation intact under the strict script policy. See [Zod CSP guidance](https://zod.dev/compile).
- **Upload limits:** enforce private Storage quotas for direct requests as well as the app: 5 recordings and 3 photos per account; 50 recordings and 100 photos across the project. RLS still checks ownership. A final-write trigger independently validates paths and active accounts, locks quota counts until commit and holds the profile FOR SHARE so removal cannot overtake an unfinished upload. Existing-key upserts are intentionally unsupported.
- **Privileged work:** retain verified users, owner filters, RLS, password-confirmed deletion and atomic processing budgets. New regressions prove exhausted budgets and failed authentication stop provider calls or admin operations.

Live concurrency testing showed that the first RLS-only quota check could be bypassed by simultaneous uploads. Storage separates its permission probe from the elevated final write; the trigger enforces the limit in that final transaction. Subsequent migrations preserve applied history while fixing an owner-column collision and closing the race. See [Storage uploader source](https://github.com/supabase/storage/blob/master/src/storage/uploader.ts).

## Verification

| Check | Result |
| --- | --- |
| Full unit suite | 226 passed |
| Full isolated production browser suite | 57 passed |
| CI for application commit `3fd93c2` | [Passed](https://github.com/usmanbutt-dev/consultnote/actions/runs/38497325789) |
| Lint, type-check, formatting and production build | Passed |
| Focused production PDF/CSP browser regression | 5 passed |
| Parallel direct uploads | Audio: 5 accepted, 1 rejected; photos: 3 accepted, 1 rejected |
| Delete at quota and upload a replacement | Passed for both buckets |
| Upload/account-retirement races | Retirement waited for an unfinished insert; elevated uploads after retirement and uploads waiting on retirement were rejected |
| Installed database settings | READ COMMITTED; both app buckets have versioning disabled; no pending migrations |
| Git/current source and browser credential scan | No configured private keys found in tracked source, Git history or 22 built browser assets |
| Production dependency audit | Zero reported vulnerabilities |

Live verification against application commit `3fd93c2` passed all of these checks:

- Two independent signed-in browser sessions; another account's records cannot be read, updated or deleted through API routes or direct database requests.
- Profiles stay private; editing the current profile succeeds, while forged IDs and foreign profile access fail.
- Recordings and photos are private. Another account cannot download or remove an owned recording, validate its path, or read its photo. Normal photo replacement retains one current file.
- Foreign/missing origins cannot delete a consultation. Foreign job reads/cancellation and direct writes to privileged job/RPC interfaces are denied.
- Exhausted notes quota returns 429 before generation. Wrong-password account deletion returns 401 and preserves data.
- Saved notes reopen and download as PDF under the strict policy. Normal tested flows emitted zero CSP violations; 13 loaded production script assets contained no configured server secrets.
- Correct-password account removal cleans owned Storage and blocks an old access token. Browser sign-out removes access to account routes.

All QA users and files were removed. No paid provider request was made during this review. Live diagnostic files remain Git-ignored; committed unit/browser regressions and [deployment verification steps](deployment.md) cover repeat checks.

## Remaining limits

The full dependency audit reports four affected development packages from one high-severity `braces` advisory, reached through the Next ESLint plugin's glob tooling. The advisory lists no patched version. The suggested automatic fix downgrades the plugin from Next 16 to 14, so it was not applied. These tools do not process application requests; monitor the [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and update compatible packages when a fix is available.

The custom trigger changes Supabase's managed Storage schema. Recheck it after Storage upgrades and keep versioning disabled; enabling delete markers or existing-key upserts requires revisiting the trigger. Supabase discourages custom schema modifications because of upgrade conflicts. [Storage schema guidance](https://supabase.com/docs/guides/storage/schema/design).

File counts and existing per-file caps bound committed app objects to approximately 700 MiB. They do not bound in-flight or temporary orphan bytes, bandwidth, or platform-level signup abuse. Failed-upload cleanup and the documented abandoned-recording cleanup remain necessary.

Sign-out clears the browser session; already issued JWTs may remain valid until expiry. [Supabase sign-out behavior](https://supabase.com/docs/guides/auth/signout). Deleted or retiring accounts are also blocked through verified-user checks and active-profile RLS. Immediate signup without email verification remains the explicitly selected demo configuration; password-reset email delivery still awaits SMTP.
