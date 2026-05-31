---
name: image-generation
description: >-
  Generate, edit, and create variations of images using AI models (GPT-Image,
  DALL-E, Gemini). Use when users want to create new images from descriptions,
  edit existing images, or create variations.
license: MIT
metadata:
  author: Ren Labs
  icon: 'https://cdn.renai.build/skill-icons/image-generation.svg'
  tags:
    - creative
---

# Image Generation

Use the image CLI at `scripts/cli.py` via bash.

## Generate

```bash
python3 scripts/cli.py generate "<prompt>" -o generated/<filename>.png [-i <input_image>] [-m <model>] [-s <size>] [--n <count>] [-q <quality>]
```

- `output`: Save to `generated/<filename>.png` in the project directory
- `image`: Optional input image(s) for image-to-image generation. Can be repeated: `-i photo.png -i ref.png`
- `model`: `openrouter/google/gemini-3-pro-image-preview` (default), `openrouter/google/gemini-2.5-flash-image`, `gpt-image-1`, `gemini-2.0-flash-exp-image-generation`
- `size`: `1024x1024`, `1792x1024`, `1024x1792`, `512x512`, `256x256`
- `n`: Number of images (1-10)
- `quality`: `auto`, `high`, `medium`, `low`, `hd`, `standard`

## Edit

```bash
python3 scripts/cli.py edit <image_path> -p "<prompt>" -o generated/<filename>.png [--mask <mask_path>] [-m <model>] [-s <size>]
```

- `mask`: Optional mask image (transparent areas = edit zones)
- `model`: Default `openrouter/google/gemini-3-pro-image-preview`
- `size`: `256x256`, `512x512`, `1024x1024`

## Variate

```bash
python3 scripts/cli.py variate <image_path> -o generated/<filename>.png [--n <count>] [-m <model>] [-s <size>]
```

- `model`: `dall-e-2`, `topaz/Standard V2`
- `size`: `256x256`, `512x512`, `1024x1024`

Always use `showcase_artifact` to display generated images to the user.
