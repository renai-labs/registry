#!/usr/bin/env python3
import json
import sys
import time
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


def wait_for_completion(
    client,
    video_id: str,
    timeout: int,
    poll_interval: int = 5,
) -> tuple[bool, Any]:
    start = time.time()
    while time.time() - start < timeout:
        status_response = client.videos.retrieve(video_id=video_id)
        if status_response.status == "completed":
            return True, status_response
        if status_response.status == "failed":
            return False, status_response
        time.sleep(poll_interval)
    return False, None


@click.group()
@click.version_option(version="0.1.0", prog_name="video")
def cli():
    """
    Video CLI Tool - AI-powered video generation and editing.

    \b
    Commands are organized into groups:
      generate  - Generate video from text/image (LiteLLM)
      status    - Check generation status (LiteLLM)
      download  - Download completed video (LiteLLM)
      list      - List all generated videos (LiteLLM)
      remix     - Edit/remix existing video (LiteLLM)
      edit      - Non-LLM video editing tools
      analyze   - Video analysis tools

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
@click.argument("prompt", type=str)
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path for video")
@click.option("--model", "-m", default="openai/sora-2", help="Model to use")
@click.option("--seconds", "-s", type=int, help="Video duration (e.g., 8, 16)")
@click.option("--size", type=str, help="Video dimensions (e.g., 720x1280, 1280x720)")
@click.option("--image", "-i", type=click.Path(exists=True), help="Reference image for generation")
@click.option("--user", type=str, help="End-user identifier")
@click.option("--wait/--no-wait", default=True, help="Wait for completion")
@click.option("--timeout", type=int, default=600, help="Max wait time in seconds")
def generate(
    prompt: str,
    output: str,
    model: str,
    seconds: int | None,
    size: str | None,
    image: str | None,
    user: str | None,
    wait: bool,
    timeout: int,
):
    """
    Generate video from text prompt.

    \b
    PROMPT is the text description of the desired video.

    \b
    Supported providers:
      - OpenAI (sora-2)
      - Azure, Gemini, Vertex AI, RunwayML

    \b
    Examples:
      video generate "A sunset timelapse" -o sunset.mp4
      video generate "Product showcase" -o product.mp4 -s 16 --size 1280x720
      video generate "Animate this" -o animated.mp4 -i photo.png
    """
    try:
        client = get_openai_client()

        kwargs: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
        }

        if seconds:
            kwargs["seconds"] = seconds
        if size:
            kwargs["size"] = size
        if image:
            kwargs["image"] = open(image, "rb")
        if user:
            kwargs["user"] = user

        response = client.videos.create(**kwargs)
        video_id = response.id

        if not wait:
            output_json({
                "status": "success",
                "message": "Video generation started",
                "data": {
                    "video_id": video_id,
                    "status": getattr(response, "status", "queued"),
                },
            })
            return

        completed, status_response = wait_for_completion(client, video_id, timeout)

        if completed:
            content = client.videos.download_content(video_id=video_id)
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(content.content)

            output_json({
                "status": "success",
                "message": "Video generated and saved",
                "data": {
                    "video_id": video_id,
                    "output_path": str(output_path),
                },
            })
        else:
            output_json({
                "status": "error",
                "message": "Video generation timed out or failed",
                "errors": ["Timeout or failure"],
            })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.command()
@click.argument("video_id", type=str)
@click.option("--model", "-m", default="openai/sora-2", help="Model used for generation")
def status(video_id: str, model: str):
    """
    Check video generation status.

    \b
    VIDEO_ID is the ID returned from generate command.

    \b
    Examples:
      video status vid_abc123 -m openai/sora-2
    """
    try:
        client = get_openai_client()
        response = client.videos.retrieve(video_id=video_id)

        output_json({
            "status": "success",
            "message": f"Video status: {response.status}",
            "data": {
                "video_id": response.id,
                "status": response.status,
                "progress": getattr(response, "progress", None),
                "created_at": getattr(response, "created_at", None),
            },
        })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.command()
@click.argument("video_id", type=str)
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path")
@click.option("--model", "-m", default="openai/sora-2", help="Model used for generation")
def download(video_id: str, output: str, model: str):
    """
    Download completed video.

    \b
    VIDEO_ID is the ID of the completed video.

    \b
    Examples:
      video download vid_abc123 -o my_video.mp4
    """
    try:
        client = get_openai_client()
        response = client.videos.download_content(video_id=video_id)

        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(response.content)

        output_json({
            "status": "success",
            "message": "Video downloaded",
            "data": {
                "video_id": video_id,
                "output_path": str(output_path),
            },
        })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.command("list")
@click.option("--model", "-m", default="openai/sora-2", help="Model to list videos for")
@click.option("--limit", type=int, default=20, help="Max results")
def list_videos(model: str, limit: int):
    """
    List all generated videos.

    \b
    Examples:
      video list -m openai/sora-2
      video list --limit 50
    """
    try:
        client = get_openai_client()
        response = client.videos.list()

        videos = []
        for item in list(response)[:limit]:
            videos.append({
                "id": item.id,
                "status": getattr(item, "status", None),
            })

        output_json({
            "status": "success",
            "message": f"Found {len(videos)} videos",
            "data": {
                "videos": videos,
                "count": len(videos),
            },
        })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.command()
@click.argument("video_id", type=str)
@click.option("--prompt", "-p", required=True, help="Edit instructions")
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path")
@click.option("--model", "-m", default="openai/sora-2", help="Model to use")
@click.option("--seconds", "-s", type=int, help="New duration")
@click.option("--size", type=str, help="New dimensions")
@click.option("--wait/--no-wait", default=True, help="Wait for completion")
@click.option("--timeout", type=int, default=600, help="Max wait time")
def remix(
    video_id: str,
    prompt: str,
    output: str,
    model: str,
    seconds: int | None,
    size: str | None,
    wait: bool,
    timeout: int,
):
    """
    Remix/edit an existing video.

    \b
    VIDEO_ID is the ID of the video to remix.

    \b
    Examples:
      video remix vid_abc123 -p "Make it more vibrant" -o remixed.mp4
      video remix vid_abc123 -p "Slow motion" -o slow.mp4 -s 16
    """
    try:
        client = get_openai_client()

        kwargs: dict[str, Any] = {
            "model": model,
            "video_id": video_id,
            "prompt": prompt,
        }

        if seconds:
            kwargs["seconds"] = seconds
        if size:
            kwargs["size"] = size

        response = client.videos.remix(**kwargs)
        new_video_id = response.id

        if not wait:
            output_json({
                "status": "success",
                "message": "Video remix started",
                "data": {
                    "video_id": new_video_id,
                    "status": getattr(response, "status", "queued"),
                },
            })
            return

        completed, status_response = wait_for_completion(client, new_video_id, timeout)

        if completed:
            content = client.videos.download_content(video_id=new_video_id)
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(content.content)

            output_json({
                "status": "success",
                "message": "Video remixed and saved",
                "data": {
                    "video_id": new_video_id,
                    "output_path": str(output_path),
                },
            })
        else:
            output_json({
                "status": "error",
                "message": "Video remix timed out or failed",
                "errors": ["Timeout or failure"],
            })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.group()
def edit():
    """
    Non-LLM video editing tools.

    \b
    Subcommands:
      enhance  - Enhance video quality
      lipsync  - Sync lips to audio
    """
    pass


@edit.command()
@click.argument("video_path", type=click.Path(exists=True))
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path")
def enhance(video_path: str, output: str):
    """
    Enhance video quality.

    \b
    Examples:
      video edit enhance input.mp4 -o enhanced.mp4
    """
    output_json(not_implemented("edit enhance"))


@edit.command()
@click.argument("video_path", type=click.Path(exists=True))
@click.option("--audio", required=True, type=click.Path(exists=True), help="Audio file")
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path")
def lipsync(video_path: str, audio: str, output: str):
    """
    Sync video lip movements to audio.

    \b
    Examples:
      video edit lipsync video.mp4 --audio speech.mp3 -o synced.mp4
    """
    output_json(not_implemented("edit lipsync"))


@cli.group()
def analyze():
    """
    Video analysis tools.

    \b
    Subcommands:
      caption - Generate captions for video
    """
    pass


@analyze.command()
@click.argument("video_path", type=click.Path(exists=True))
def caption(video_path: str):
    """
    Generate captions for video.

    \b
    Examples:
      video analyze caption video.mp4
    """
    output_json(not_implemented("analyze caption"))


if __name__ == "__main__":
    cli()
