All four `tone.*` files are one-second, computer-generated sine waves. They contain no speech or patient information. Regenerate with `node tests/fixtures/audio/generate.mjs` (FFmpeg required).

Unit tests also generate silent PCM WAV bytes in memory. Browser tests use Chromium's synthetic microphone and its real MediaRecorder; recordings remain in test memory.

Probe-output JSON under `../probe/` is mocked metadata, not audio.
