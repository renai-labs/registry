#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from typing import Any

import click

TOOLS_DIR = Path(__file__).parent
sys.path.insert(0, str(TOOLS_DIR))

from core.client import get_openai_client


def output_json(data: dict[str, Any]) -> None:
    click.echo(json.dumps(data, indent=2, default=str))


def not_implemented(command: str) -> dict[str, Any]:
    return {
        "status": "error",
        "message": f"Command '{command}' is not yet implemented",
        "errors": ["Not implemented"],
    }


@click.group()
@click.version_option(version="0.1.0", prog_name="audio")
def cli():
    """
    Audio CLI Tool - AI-powered audio generation and transcription.

    \b
    Commands are organized into groups:
      speech     - Convert text to speech (LiteLLM)
      transcribe - Convert speech to text (LiteLLM)
      generate   - Non-LLM audio generation tools
      analyze    - Audio analysis tools

    \b
    All commands output JSON with the following structure:
      {
        "status": "success|error|warning",
        "message": "Operation description",
        "data": { ... },
        "errors": [],
        "warnings": []
      }
    """
    pass


@cli.command()
@click.argument("text", type=str)
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path for audio file")
@click.option("--model", "-m", default="openai/tts-1", help="Model to use for TTS")
@click.option(
    "--voice",
    "-v",
    default="alloy",
    type=click.Choice(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]),
    help="Voice selection",
)
@click.option("--timeout", type=int, default=600, help="API timeout in seconds")
def speech(
    text: str,
    output: str,
    model: str,
    voice: str,
    timeout: int,
):
    """
    Convert text to speech using AI models.

    \b
    TEXT is the text to convert to speech.

    \b
    Supported providers:
      - OpenAI (tts-1, tts-1-hd)
      - Azure, Vertex AI, AWS Polly
      - ElevenLabs, MiniMax, Gemini

    \b
    Examples:
      audio speech "Hello world" -o hello.mp3
      audio speech "Welcome to our app" -o welcome.mp3 -m openai/tts-1-hd -v nova
      audio speech "Long text here" -o output.mp3 --timeout 120
    """
    try:
        client = get_openai_client()

        response = client.audio.speech.create(
            model=model,
            input=text,
            voice=voice,
            timeout=timeout,
        )

        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        response.stream_to_file(str(output_path))

        output_json({
            "status": "success",
            "message": "Audio generated and saved",
            "data": {
                "output_path": str(output_path),
            },
        })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.command()
@click.argument("audio_path", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="Save transcript to file")
@click.option("--model", "-m", default="openai/whisper-1", help="Model to use for transcription")
@click.option("--timeout", type=int, default=600, help="API timeout in seconds")
def transcribe(
    audio_path: str,
    output: str | None,
    model: str,
    timeout: int,
):
    """
    Transcribe audio to text using AI models.

    \b
    AUDIO_PATH is the path to the audio file to transcribe.

    \b
    Supported providers:
      - OpenAI (whisper-1)
      - Azure, Vertex AI, Gemini
      - Deepgram, Groq, Fireworks AI

    \b
    Examples:
      audio transcribe recording.mp3
      audio transcribe meeting.wav -o transcript.txt
      audio transcribe interview.mp3 -m groq/whisper-large-v3
    """
    try:
        client = get_openai_client()

        with open(audio_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model=model,
                file=f,
                timeout=timeout,
            )

        transcript = response.text

        result_data = {"text": transcript}

        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(transcript)
            result_data["output_path"] = str(output_path)

        output_json({
            "status": "success",
            "message": "Audio transcribed",
            "data": result_data,
        })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.group()
def generate():
    """
    Non-LLM audio generation tools.

    \b
    Subcommands:
      music - Generate music from text description
    """
    pass


@generate.command()
@click.option("--prompt", "-p", required=True, help="Music description")
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path")
def music(prompt: str, output: str):
    """
    Generate music from text description.

    \b
    Examples:
      audio generate music --prompt "upbeat jazz" -o music.mp3
    """
    output_json(not_implemented("generate music"))


@cli.group()
def analyze():
    """
    Audio analysis tools.

    \b
    Subcommands:
      diarize - Identify speakers in audio
    """
    pass


@analyze.command()
@click.argument("audio_path", type=click.Path(exists=True))
def diarize(audio_path: str):
    """
    Identify speakers in audio.

    \b
    Examples:
      audio analyze diarize meeting.mp3
    """
    output_json(not_implemented("analyze diarize"))


if __name__ == "__main__":
    cli()
