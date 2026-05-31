---
name: video-generation
description: >-
  Generate videos from text prompts using AI models (Sora, Veo). Use when users
  want to create videos from descriptions, check generation status, download
  completed videos, or list generated videos.
license: MIT
metadata:
  author: Ren Labs
  icon: 'https://cdn.renai.build/skill-icons/video-generation.svg'
  tags:
    - video
    - creative
---

# Video Generation

Use the video CLI at `scripts/cli.py` via bash.

## Generate

```bash
python3 scripts/cli.py generate "<prompt>" -o generated/<filename>.mp4 [-m <model>] [-s <seconds>] [--size <dimensions>] [-i <image_path>] [--no-wait] [--timeout <seconds>]
```

- `output`: Save to `generated/<filename>.mp4` in the project directory
- `model`: `openai/sora-2` (default), `veo-3`
- `seconds`: Duration (e.g., 8, 16)
- `size`: `720x1280`, `1280x720`
- `image`: Reference image for image-to-video
- `--no-wait`: Don't wait for completion (returns video ID)
- `timeout`: Max wait time in seconds (default: 600)

## Check Status

```bash
python3 scripts/cli.py status <video_id> -m <model>
```

## Download

```bash
python3 scripts/cli.py download <video_id> -o generated/<filename>.mp4 -m <model>
```

## List Videos

```bash
python3 scripts/cli.py list -m <model> --limit <count>
```

- `model`: Default `openai/sora-2`
- `limit`: Default 20

Always use `showcase_artifact` to display generated videos to the user.
