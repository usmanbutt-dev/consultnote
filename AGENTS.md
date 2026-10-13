# ConsultNote development

- Read `README.md`, the design, and the implementation plan before changing application behavior.
- Preserve the agreed scope: a single-user interview demo using fictional conversations and Gemini first.
- Reuse existing code and native browser/Node features before adding dependencies. Keep changes focused.
- Keep Gemini credentials and calls in server-only modules. Never commit recordings, secrets, or the local database.
- Treat speaker roles as suggestions until reviewed. Preserve unknown roles and uncertainty. Notes must cite transcript segments.
- Validate uploaded audio, AI responses, and save/update payloads at their boundaries. Return useful failures without losing the current draft.
- Keep documentation accurate about implemented versus planned features. Record model and prompt versions in AI evaluation results.
- Use meaningful tests for processing, persistence, and user flows. Run the checks defined in `package.json` before claiming an implementation milestone passes.
- Use short-lived feature branches and focused commits. Do not publish a remote or deploy a public instance as part of local implementation.
