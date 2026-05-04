#!/usr/bin/env python3
import base64
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


def is_chat_image_model(model: str) -> bool:
    chat_patterns = ["gemini", "nano-banana"]
    return any(p in model.lower() for p in chat_patterns)


def encode_image_to_data_url(image_path: str) -> str:
    path = Path(image_path)
    suffix = path.suffix.lower()
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}
    mime = mime_map.get(suffix, "image/png")
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{b64}"


def save_base64_data_url(data_url: str, file_path: Path) -> None:
    header, b64_data = data_url.split(",", 1)
    image_data = base64.b64decode(b64_data)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(image_data)


def save_images_from_chat(images: list[dict], output_path: str) -> dict[str, Any]:
    output = Path(output_path)
    saved_files = []

    if len(images) == 1 and not output_path.endswith("/"):
        save_base64_data_url(images[0]["image_url"]["url"], output)
        saved_files.append(str(output))
    else:
        output.mkdir(parents=True, exist_ok=True)
        for i, img in enumerate(images):
            file_path = output / f"image_{i:03d}.png"
            save_base64_data_url(img["image_url"]["url"], file_path)
            saved_files.append(str(file_path))

    return {"saved_files": saved_files, "urls": []}


def save_images(response_data: list, output_path: str, response_format: str) -> dict[str, Any]:
    output = Path(output_path)
    saved_files = []
    urls = []

    if len(response_data) == 1 and not output_path.endswith("/"):
        item = response_data[0]
        if hasattr(item, "b64_json") and item.b64_json:
            image_data = base64.b64decode(item.b64_json)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(image_data)
            saved_files.append(str(output))
        elif hasattr(item, "url") and item.url:
            urls.append(item.url)
    else:
        output.mkdir(parents=True, exist_ok=True)
        for i, item in enumerate(response_data):
            if hasattr(item, "b64_json") and item.b64_json:
                image_data = base64.b64decode(item.b64_json)
                file_path = output / f"image_{i:03d}.png"
                file_path.write_bytes(image_data)
                saved_files.append(str(file_path))
            elif hasattr(item, "url") and item.url:
                urls.append(item.url)

    return {"saved_files": saved_files, "urls": urls}


@click.group()
@click.version_option(version="0.1.0", prog_name="image")
def cli():
    """
    Image CLI Tool - AI-powered image generation and editing.

    \b
    Commands are organized into groups:
      generate   - Generate images from text prompts
      edit       - Edit existing images with AI
      variate    - Create variations of an image [BETA]
      transform  - Image transformations (upscale, remove-bg, restore)
      analyze    - Analysis tools (caption, ocr, detect)

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
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path for generated image(s)")
@click.option("--model", "-m", default="openrouter/google/gemini-3-pro-image-preview", help="Model to use for generation")
@click.option("--image", "-i", type=click.Path(exists=True), multiple=True, help="Input image(s) for image-to-image generation (can be repeated)")
@click.option(
    "--size",
    "-s",
    type=click.Choice(["256x256", "512x512", "1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"]),
    default="1024x1024",
    help="Image size",
)
@click.option("--n", type=click.IntRange(1, 10), default=1, help="Number of images to generate (1-10)")
@click.option(
    "--quality",
    "-q",
    type=click.Choice(["auto", "high", "medium", "low", "hd", "standard"]),
    default="auto",
    help="Image quality",
)
@click.option("--style", type=str, help="Image style parameter")
@click.option(
    "--response-format",
    type=click.Choice(["url", "b64_json"]),
    default=None,
    help="Response format (b64_json for saving locally, omit for model default)",
)
@click.option("--timeout", type=int, default=600, help="API timeout in seconds")
@click.option("--user", type=str, help="End-user identifier for tracking")
def generate(
    prompt: str,
    output: str,
    model: str,
    image: tuple[str, ...],
    size: str,
    n: int,
    quality: str,
    style: str | None,
    response_format: str,
    timeout: int,
    user: str | None,
):
    """
    Generate images from text prompts using AI models.

    \b
    PROMPT is the text description of the desired image(s).

    \b
    Supported models include:
      - openrouter/google/gemini-3-pro-image-preview (default, supports image input)
      - openai/gpt-image-1, dall-e-3, dall-e-2
      - Azure, Vertex AI, Bedrock models

    \b
    Examples:
      image generate "A sunset over mountains" -o sunset.png
      image generate "A cat in space" -o cat.png -m dall-e-3 -s 1792x1024 -q hd
      image generate "Product photo" -o products/ -n 4 --style vivid
      image generate "Make this photo look like a painting" -i photo.png -o painting.png
      image generate "Combine these into one scene" -i bg.png -i subject.png -o combined.png
    """
    try:
        client = get_openai_client()

        if is_chat_image_model(model):
            content: list[dict[str, Any]] = []
            for img_path in image:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": encode_image_to_data_url(img_path)},
                })
            if n == 1:
                content.append({"type": "text", "text": f"{prompt}\n\nGenerate exactly 1 image."})
            else:
                content.append({"type": "text", "text": f"{prompt}\n\nGenerate exactly {n} images."})

            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": content}],
                modalities=["image", "text"],
                timeout=timeout,
            )

            images = getattr(response.choices[0].message, "images", None) or []
            if not images:
                output_json({
                    "status": "error",
                    "message": "Model returned no images",
                    "errors": ["No images in response"],
                    "data": {"text": response.choices[0].message.content},
                })
                return

            result = save_images_from_chat(images, output)
            output_json({
                "status": "success",
                "message": f"Generated {len(images)} image(s)",
                "data": result,
            })
        else:
            kwargs: dict[str, Any] = {
                "prompt": prompt,
                "model": model,
                "size": size,
                "n": n,
                "quality": quality,
                "timeout": timeout,
            }

            if response_format:
                kwargs["response_format"] = response_format
            if style:
                kwargs["style"] = style
            if user:
                kwargs["user"] = user

            response = client.images.generate(**kwargs)
            result = save_images(response.data, output, response_format or "b64_json")

            output_json({
                "status": "success",
                "message": f"Generated {len(response.data)} image(s)",
                "data": result,
            })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.command()
@click.argument("image_path", type=click.Path(exists=True))
@click.option("--prompt", "-p", required=True, help="Text description of the desired edit")
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path for edited image(s)")
@click.option("--mask", type=click.Path(exists=True), help="Mask image for inpainting (transparent areas = edit zones)")
@click.option("--model", "-m", default="openrouter/google/gemini-3-pro-image-preview", help="Model to use for editing")
@click.option(
    "--size",
    "-s",
    type=click.Choice(["256x256", "512x512", "1024x1024"]),
    default="1024x1024",
    help="Output image size",
)
@click.option("--n", type=click.IntRange(1, 10), default=1, help="Number of edited images to generate (1-10)")
@click.option(
    "--response-format",
    type=click.Choice(["url", "b64_json"]),
    default="b64_json",
    help="Response format",
)
@click.option("--timeout", type=int, default=600, help="API timeout in seconds")
@click.option("--user", type=str, help="End-user identifier for tracking")
def edit(
    image_path: str,
    prompt: str,
    output: str,
    mask: str | None,
    model: str,
    size: str,
    n: int,
    response_format: str,
    timeout: int,
    user: str | None,
):
    """
    Edit an existing image using AI.

    \b
    IMAGE_PATH is the path to the image to edit (PNG, <4MB, square recommended).

    \b
    Use --mask to specify areas to edit (transparent areas will be modified).

    \b
    Supported providers:
      - Gemini (default, via chat completions)
      - OpenAI (dall-e-2, via images API)
      - Stability AI, AWS Bedrock

    \b
    Examples:
      image edit photo.png -p "Add sunglasses to the person" -o edited.png
      image edit room.png -p "Replace the couch" -o room_new.png --mask mask.png
      image edit product.png -p "Change background to white" -o product_white.png -n 3
    """
    try:
        client = get_openai_client()

        if is_chat_image_model(model):
            content: list[dict[str, Any]] = [
                {"type": "image_url", "image_url": {"url": encode_image_to_data_url(image_path)}},
            ]
            text = f"Edit the image using the provided mask. {prompt}" if mask else prompt
            if n == 1:
                text = f"{text}\n\nGenerate exactly 1 image."
            else:
                text = f"{text}\n\nGenerate exactly {n} images."
            if mask:
                content.append({"type": "image_url", "image_url": {"url": encode_image_to_data_url(mask)}})
            content.append({"type": "text", "text": text})

            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": content}],
                modalities=["image", "text"],
                timeout=timeout,
            )

            images = getattr(response.choices[0].message, "images", None) or []
            if not images:
                output_json({
                    "status": "error",
                    "message": "Model returned no images",
                    "errors": ["No images in response"],
                    "data": {"text": response.choices[0].message.content},
                })
                return

            result = save_images_from_chat(images, output)
            output_json({
                "status": "success",
                "message": f"Edited image with {len(images)} result(s)",
                "data": result,
            })
        else:
            kwargs: dict[str, Any] = {
                "image": open(image_path, "rb"),
                "prompt": prompt,
                "model": model,
                "size": size,
                "n": n,
                "response_format": response_format,
                "timeout": timeout,
            }

            if mask:
                kwargs["mask"] = open(mask, "rb")
            if user:
                kwargs["user"] = user

            response = client.images.edit(**kwargs)
            result = save_images(response.data, output, response_format)

            output_json({
                "status": "success",
                "message": f"Edited image with {len(response.data)} result(s)",
                "data": result,
            })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.command()
@click.argument("image_path", type=click.Path(exists=True))
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path for variation(s)")
@click.option("--model", "-m", default="dall-e-2", help="Model to use (dall-e-2, topaz/Standard V2)")
@click.option("--n", type=click.IntRange(1, 10), default=1, help="Number of variations to generate (1-10)")
@click.option(
    "--size",
    "-s",
    type=click.Choice(["256x256", "512x512", "1024x1024"]),
    help="Output image size",
)
@click.option(
    "--response-format",
    type=click.Choice(["url", "b64_json"]),
    default="b64_json",
    help="Response format",
)
@click.option("--timeout", type=int, default=600, help="API timeout in seconds")
@click.option("--user", type=str, help="End-user identifier for tracking")
def variate(
    image_path: str,
    output: str,
    model: str,
    n: int,
    size: str | None,
    response_format: str,
    timeout: int,
    user: str | None,
):
    """
    Create variations of an existing image. [BETA]

    \b
    IMAGE_PATH is the path to the source image.

    \b
    Supported providers:
      - OpenAI (dall-e-2)
      - Topaz (topaz/Standard V2)

    \b
    Examples:
      image variate logo.png -o variations/ -n 4
      image variate design.png -o design_var.png -m dall-e-2 -s 1024x1024
    """
    try:
        client = get_openai_client()

        kwargs = {
            "image": open(image_path, "rb"),
            "model": model,
            "n": n,
            "response_format": response_format,
            "timeout": timeout,
        }

        if size:
            kwargs["size"] = size
        if user:
            kwargs["user"] = user

        response = client.images.create_variation(**kwargs)

        result = save_images(response.data, output, response_format)

        output_json({
            "status": "success",
            "message": f"Created {len(response.data)} variation(s)",
            "data": result,
        })

    except Exception as e:
        output_json({
            "status": "error",
            "message": str(e),
            "errors": [str(e)],
        })


@cli.group()
def transform():
    """
    Image transformations.

    \b
    Subcommands:
      upscale    - Upscale image resolution
      remove-bg  - Remove image background
      restore    - Restore old or degraded images
    """
    pass


@transform.command()
@click.argument("image_path", type=click.Path(exists=True))
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path")
def upscale(image_path: str, output: str):
    """
    Upscale an image to higher resolution.

    \b
    Examples:
      image transform upscale photo.png -o photo_hd.png
    """
    output_json(not_implemented("transform upscale"))


@transform.command("remove-bg")
@click.argument("image_path", type=click.Path(exists=True))
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path")
def remove_bg(image_path: str, output: str):
    """
    Remove background from an image.

    \b
    Examples:
      image transform remove-bg product.png -o product_nobg.png
    """
    output_json(not_implemented("transform remove-bg"))


@transform.command()
@click.argument("image_path", type=click.Path(exists=True))
@click.option("--output", "-o", required=True, type=click.Path(), help="Output path")
def restore(image_path: str, output: str):
    """
    Restore an old or degraded image.

    \b
    Examples:
      image transform restore old_photo.png -o restored.png
    """
    output_json(not_implemented("transform restore"))


@cli.group()
def analyze():
    """
    Image analysis tools.

    \b
    Subcommands:
      caption - Generate caption for an image
      ocr     - Extract text from image
      detect  - Detect objects in image
    """
    pass


@analyze.command()
@click.argument("image_path", type=click.Path(exists=True))
def caption(image_path: str):
    """
    Generate a caption for an image.

    \b
    Examples:
      image analyze caption photo.png
    """
    output_json(not_implemented("analyze caption"))


@analyze.command()
@click.argument("image_path", type=click.Path(exists=True))
def ocr(image_path: str):
    """
    Extract text from an image using OCR.

    \b
    Examples:
      image analyze ocr document.png
    """
    output_json(not_implemented("analyze ocr"))


@analyze.command()
@click.argument("image_path", type=click.Path(exists=True))
def detect(image_path: str):
    """
    Detect objects in an image.

    \b
    Examples:
      image analyze detect street.png
    """
    output_json(not_implemented("analyze detect"))


if __name__ == "__main__":
    cli()
