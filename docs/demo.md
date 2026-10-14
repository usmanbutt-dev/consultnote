# ConsultNote: submission and five-minute demonstration

ConsultNote runs locally with Node.js 24 and FFmpeg/ffprobe. It records or uploads fictional consultations, separates speakers, suggests doctor/patient/unknown roles, generates editable notes with transcript sources, saves text in SQLite and exports Markdown. It does not make clinical decisions.

## Setup

1. Install Node.js 24 LTS and FFmpeg. Confirm `node --version` and `ffprobe -version`.
2. From the project directory, run `npm ci`.
3. Copy `.env.example` to `.env.local` on a new checkout. Add `ASSEMBLYAI_API_KEY` and `GROQ_API_KEY`; select `TRANSCRIPTION_PROVIDER=assemblyai` and `GROQ_MODEL=openai/gpt-oss-120b`. Keep existing local credentials if already configured.
4. Run `npm run dev` and open `http://127.0.0.1:3000`. Microphone access requires localhost or HTTPS.

Keys remain on the server. Audio is sent to AssemblyAI; transcript text is sent to Groq. Provider-side retention follows their terms. SQLite stores reviewed text, not recordings. Do not include `.env*`, `.data`, recordings, `.superpowers` or `node_modules` in a submission archive; `.env.example` and the lockfile belong in the submission.

## Five-minute walkthrough

1. Explain the problem: capture the full conversation, including financial and practical context, without treating generated notes as verified facts.
2. Upload a short fictional recording or record both participants. Play it back, then select **Create notes**. Explain the two visible progress stages and Cancel.
3. Review the draft notes. Select **View conversation** to inspect the words and speaker roles. Expand **See in conversation** and select a passage to focus its supporting text; edit one note's wording. Changing transcript text or roles discards outdated notes after confirmation; **Create notes** then uses the edited transcript without re-uploading audio.
4. Review the suggested title and select **Save consultation**. Start a new consultation, reopen the saved title from history and show that the recording is absent. Rename and save it, then select **Download notes** and choose **PDF document (.pdf)**. Show its readable headings, bullet points and title-based filename. Plain text contains the same notes; Markdown also includes the conversation and source links.
5. Explain failures: a provider error preserves the draft; cancelled/stale results are ignored; editing transcript text or roles asks before invalidating notes; stale notes cannot be saved.

## Review saved notes without new AI calls

Open a previously saved fictional consultation from history. Its notes appear first, with the conversation available on demand. Review, edit and download the saved material without new AI calls. Older prepared examples keep their **Prepared fictional sample** banner and download label. The home screen offers recording and upload only; regenerating notes requires Groq.

Prepare and save a reviewed fictional consultation before the interview. If AI services are unavailable, use that saved record to demonstrate the review/storage/export workflow. Do not represent it as live transcription or a new AI result.

## Architecture explanation

- Native browser APIs capture audio; Next.js Node route handlers independently validate signatures, duration and payload sizes.
- AssemblyAI submits one diarized transcription job. Polling retrieves that same job rather than generating it again. Groq assigns roles to the identified voices; unavailable suggestions remain unknown for manual review.
- A second Groq request creates schema-constrained notes from reviewed text. Zod checks the structure and source IDs. A SHA-256 digest binds notes to the exact transcript and roles; the server rejects stale digests on save.
- Prepared SQLite statements provide local persistence. Markdown preserves reviewed roles, notes, source links and transcript text. Older saved examples retain explicit fictional-sample labels.
- Gemini remains an explicitly selectable transcription alternative. The initial Gemini tests encountered overload/timeouts; they are recorded rather than hidden.

## Verification and limitations

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run test:e2e`. Stop an existing development server before the standard browser suite, which starts its own server on port 3100. Automated provider responses are controlled and require no keys. CI runs the same contract on Node 24 with FFmpeg.

See [AI evaluation](ai-evaluation.md) for actual model observations. Valid JSON and valid source IDs do not prove factual support: a model can still misattribute a statement, infer agreement or omit context. Speaker labels and timestamps can also be wrong. Review them against the audio. This release is a single-user localhost interview demonstration; public hosting and access control are separate work.
