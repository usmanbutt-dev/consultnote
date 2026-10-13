# ConsultNote development

- Read `README.md`, the design, and the implementation plan before changing application behavior.
- Preserve the agreed scope: doctor accounts with private workspaces in an interview demo using fictional conversations. AssemblyAI/Groq is the approved default; Gemini remains an explicitly selected transcription alternative.
- Reuse existing code and native browser/Node features before adding dependencies. Keep changes focused.
- Keep Gemini credentials and calls in server-only modules. Never commit recordings, secrets, or the local database.
- Treat speaker roles as suggestions until reviewed. Preserve unknown roles and uncertainty. Notes must cite transcript segments.
- Validate uploaded audio, AI responses, and save/update payloads at their boundaries. Return useful failures without losing the current draft.
- Keep documentation accurate about implemented versus planned features. Record model and prompt versions in AI evaluation results.
- Use meaningful tests for processing, persistence, and user flows. Run the checks defined in `package.json` before claiming an implementation milestone passes.
- Use short-lived feature branches and focused commits. Do not publish a remote or deploy a public instance as part of local implementation.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
