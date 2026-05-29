---
name: audio-generation
description: Convert text to speech and transcribe audio using AI models (OpenAI TTS, ElevenLabs, Whisper). Use when users want to generate audio from text or transcribe speech to text.
---

# Audio Generation

Use the audio CLI at `scripts/cli.py` via bash.

## Text to Speech

```bash
python3 scripts/cli.py speech "<text>" -o generated/<filename>.mp3 [-m <model>] [-v <voice>] [--timeout <seconds>]
```

- `output`: Save to `generated/<filename>.mp3` in the project directory
- `model`: `openai/tts-1` (default), `openai/tts-1-hd`, `elevenlabs-tts`
- `voice`: `alloy` (default), `echo`, `fable`, `onyx`, `nova`, `shimmer`
- `timeout`: Default 600 seconds

## Transcribe Audio

```bash
python3 scripts/cli.py transcribe <audio_path> [-o <output_path>] [-m <model>] [--timeout <seconds>]
```

- `model`: `openai/whisper-1` (default), `elevenlabs-transcription`
- `output`: Optional file path for transcript text
- `timeout`: Default 600 seconds

Always use `showcase_artifact` to display generated audio to the user.
