---
name: meme-generation
description: >-
  Generate real meme images by picking a template and overlaying text with
  Pillow. Produces actual .png meme files.
license: MIT
author: adanaleycio
source: >-
  https://github.com/NousResearch/hermes-agent/tree/main/optional-skills/creative/meme-generation
---

# Meme Generation

Generate actual meme images from a topic. Picks a template, writes captions, and renders a real .png file with text overlay.

## When to Use

- User asks you to make or generate a meme
- User wants a meme about a specific topic, situation, or frustration
- User says "meme this" or similar

## Setup

Required Python packages: `Pillow` (always), `requests` (optional — falls back to `urllib`).

```bash
pip install Pillow requests
```

Run the generator from this skill's directory so `scripts/templates.json` and `scripts/.cache/` resolve correctly:

```bash
python3 scripts/generate_meme.py --list
```

No env vars are required. The script downloads imgflip template images on first use and caches them under `scripts/.cache/`.

## Available Templates

The script supports **any of the ~100 popular imgflip templates** by name or ID, plus 10 curated templates with hand-tuned text positioning.

### Curated Templates (custom text placement)

| ID | Name | Fields | Best for |
|----|------|--------|----------|
| `this-is-fine` | This is Fine | top, bottom | chaos, denial |
| `drake` | Drake Hotline Bling | reject, approve | rejecting/preferring |
| `distracted-boyfriend` | Distracted Boyfriend | distraction, current, person | temptation, shifting priorities |
| `two-buttons` | Two Buttons | left, right, person | impossible choice |
| `expanding-brain` | Expanding Brain | 4 levels | escalating irony |
| `change-my-mind` | Change My Mind | statement | hot takes |
| `woman-yelling-at-cat` | Woman Yelling at Cat | woman, cat | arguments |
| `one-does-not-simply` | One Does Not Simply | top, bottom | deceptively hard things |
| `grus-plan` | Gru's Plan | step1-3, realization | plans that backfire |
| `batman-slapping-robin` | Batman Slapping Robin | robin, batman | shutting down bad ideas |

### Dynamic Templates (from imgflip API)

Any template not in the curated list can be used by name or imgflip ID. These get smart default text positioning (top/bottom for 2-field, evenly spaced for 3+). Search with:

```bash
python3 scripts/generate_meme.py --search "disaster"
```

## Procedure

### Mode 1: Classic Template (default)

1. Read the user's topic and identify the core dynamic (chaos, dilemma, preference, irony, etc.)
2. Pick the template that best matches. Use the "Best for" column, or search with `--search`.
3. Write short captions for each field (8-12 words max per field, shorter is better).
4. Run the generator:
   ```bash
   python3 scripts/generate_meme.py <template_id> /tmp/meme.png "caption 1" "caption 2" ...
   ```
5. Display the result with `showcase_artifact /tmp/meme.png`.

### Mode 2: Custom AI Image

Use this when no classic template fits, or when the user wants something original.

1. Write the captions first.
2. Use the **`image-generation` skill** to create a scene that matches the meme concept. Do NOT include any text in the image prompt — text will be added by this script. Describe only the visual scene. Save the result to a known path, e.g. `/tmp/scene.png`.
3. Run the generator with `--image` to overlay text, choosing a mode:
   - **Overlay** (text directly on image, white with black outline):
     ```bash
     python3 scripts/generate_meme.py --image /tmp/scene.png /tmp/meme.png "top text" "bottom text"
     ```
   - **Bars** (black bars above/below with white text — cleaner, always readable):
     ```bash
     python3 scripts/generate_meme.py --image /tmp/scene.png --bars /tmp/meme.png "top text" "bottom text"
     ```
   Use `--bars` when the image is busy/detailed and text would be hard to read on top of it.
4. **Verify legibility:** read the output image back (with the Read tool) and check that the text is readable and well-placed. If it's not, switch between overlay and `--bars`, or regenerate the scene with a different prompt.
5. Display the result with `showcase_artifact /tmp/meme.png`.

## Examples

**"debugging production at 2 AM":**
```bash
python3 scripts/generate_meme.py this-is-fine /tmp/meme.png "SERVERS ARE ON FIRE" "This is fine"
```

**"choosing between sleep and one more episode":**
```bash
python3 scripts/generate_meme.py drake /tmp/meme.png "Getting 8 hours of sleep" "One more episode at 3 AM"
```

**"the stages of a Monday morning":**
```bash
python3 scripts/generate_meme.py expanding-brain /tmp/meme.png "Setting an alarm" "Setting 5 alarms" "Sleeping through all alarms" "Working from bed"
```

See `EXAMPLES.md` for more.

## Listing Templates

To see all available templates:

```bash
python3 scripts/generate_meme.py --list
```

## Pitfalls

- Keep captions SHORT. Memes with long text look terrible.
- Match the number of text arguments to the template's field count.
- Pick the template that fits the joke structure, not just the topic.
- Do not generate hateful, abusive, or personally targeted content.
- The script caches template images in `scripts/.cache/` after first download.

## Verification

The output is correct if:
- A .png file was created at the output path
- Text is legible (white with black outline) on the template
- The joke lands — caption matches the template's intended structure
- The image renders correctly when shown via `showcase_artifact`
