---
name: comfyui
description: >-
  Generate images, video, and audio with ComfyUI on Comfy Cloud — submit
  workflows, inject parameters, monitor jobs, and download outputs via the
  hosted REST/WebSocket API.
license: MIT
author: 'kshitijk4poor, alt-glitch'
source: 'https://github.com/NousResearch/hermes-agent/tree/main/skills/creative/comfyui'
---

# ComfyUI (Comfy Cloud)

Generate images, video, audio, and 3D content through **Comfy Cloud** —
hosted ComfyUI on RTX 6000 Pro GPUs with all common models pre-installed.

This skill talks to the Cloud REST/WebSocket API directly. There is no
local install, no GPU detection, no `comfy-cli` lifecycle — just an API
key and the workflow execution scripts.

## What's in this skill

**Reference docs (`references/`):**

- `rest-api.md` — REST + WebSocket endpoints, payload schemas, auth, cloud routing
- `workflow-format.md` — API-format JSON, common node types, param mapping

**Scripts (`scripts/`):**

| Script | Purpose |
|--------|---------|
| `_common.py` | Shared HTTP, cloud routing, node catalogs (don't run directly) |
| `extract_schema.py` | Read a workflow → list controllable params + model deps |
| `check_deps.py` | Check workflow against the cloud server → list missing nodes/models |
| `run_workflow.py` | Inject params, submit, monitor, download outputs (HTTP or WS) |
| `run_batch.py` | Submit a workflow N times with sweeps, parallel up to your tier |
| `ws_monitor.py` | Real-time WebSocket viewer for executing jobs (live progress) |
| `health_check.py` | Verification checklist — server reachable, models available, smoke test |
| `fetch_logs.py` | Pull traceback / status messages for a given prompt_id |

**Example workflows (`workflows/`):** SD 1.5, SDXL, Flux Dev, SDXL img2img,
SDXL inpaint, ESRGAN upscale, AnimateDiff video, Wan T2V. See
`workflows/README.md`.

## When to Use

- User asks to generate images with Stable Diffusion, SDXL, Flux, SD3, etc.
- User wants to run a specific ComfyUI workflow file
- User wants to chain generative steps (txt2img → upscale → face restore)
- User needs ControlNet, inpainting, or img2img pipelines
- User wants video/audio/3D generation via AnimateDiff, Hunyuan, Wan, etc.
- User has no capable local GPU, or wants zero setup

## Quick Start

### 1. Get an API key

1. Sign up at https://comfy.org/cloud
2. Generate an API key at https://platform.comfy.org/login
3. Export it once per shell session:
   ```bash
   export COMFY_CLOUD_API_KEY="comfyui-xxxxxxxxxxxx"
   ```

The scripts pick this up automatically — no need to pass it as a flag.

### 2. Health check

```bash
python3 scripts/health_check.py --host https://cloud.comfy.org
# → JSON: server reachable? checkpoints available? smoke test passes?
```

### 3. Run a workflow

```bash
python3 scripts/run_workflow.py \
  --workflow workflows/flux_dev_txt2img.json \
  --args '{"prompt": "a beautiful sunset over mountains", "seed": -1, "steps": 30}' \
  --host https://cloud.comfy.org \
  --output-dir ./outputs
```

`-1` for `seed` (or `--randomize-seed` with no seed) generates a fresh
random seed per run. The actual seed is logged to stderr.

## Core Workflow

### Step 1: Get a workflow JSON in API format

Workflows must be in API format (each node has `class_type`). They come from:

- ComfyUI web UI → **Workflow → Export (API)** (newer UI) or
  the legacy "Save (API Format)" button (older UI)
- This skill's `workflows/` directory (ready-to-run examples)
- Community downloads (civitai, Reddit, Discord) — usually editor format,
  must be loaded into ComfyUI then re-exported

Editor format (top-level `nodes` and `links` arrays) is **not directly
executable**. The scripts detect this and tell you to re-export.

### Step 2: See what's controllable

```bash
python3 scripts/extract_schema.py workflow_api.json --summary-only
# → {"parameter_count": 12, "has_negative_prompt": true, "has_seed": true, ...}

python3 scripts/extract_schema.py workflow_api.json
# → full schema with parameters, model deps, embedding refs
```

### Step 3: Run with parameters

```bash
# Standard run
python3 scripts/run_workflow.py \
  --workflow workflow_api.json \
  --args '{"prompt": "..."}' \
  --host https://cloud.comfy.org \
  --output-dir ./outputs

# Real-time progress via WebSocket (requires `pip install websocket-client`)
python3 scripts/run_workflow.py \
  --workflow flux_dev.json \
  --args '{"prompt": "..."}' \
  --host https://cloud.comfy.org \
  --ws

# img2img / inpaint: pass --input-image to upload + reference automatically
python3 scripts/run_workflow.py \
  --workflow sdxl_img2img.json \
  --input-image image=./photo.png \
  --args '{"prompt": "make it watercolor", "denoise": 0.6}' \
  --host https://cloud.comfy.org

# Batch / sweep: 8 random seeds, parallel up to cloud tier limit
python3 scripts/run_batch.py \
  --workflow sdxl.json \
  --args '{"prompt": "abstract"}' \
  --count 8 --randomize-seed --parallel 3 \
  --host https://cloud.comfy.org \
  --output-dir ./outputs/batch
```

### Step 4: Present results

The scripts emit JSON to stdout describing every output file:

```json
{
  "status": "success",
  "prompt_id": "abc-123",
  "outputs": [
    {"file": "./outputs/sdxl_00001_.png", "node_id": "9",
     "type": "image", "filename": "sdxl_00001_.png"}
  ]
}
```

## Decision Tree

| User says | Command |
|-----------|---------|
| "is everything ready?" | `health_check.py --host https://cloud.comfy.org` (optionally `--workflow X --smoke-test`) |
| "what can I change in this workflow?" | `extract_schema.py W.json` |
| "check if W's deps are met on cloud" | `check_deps.py W.json --host https://cloud.comfy.org` |
| "generate an image" | `run_workflow.py --workflow W --args '{...}' --host https://cloud.comfy.org` |
| "use this image" (img2img) | `run_workflow.py --input-image image=./x.png ... --host https://cloud.comfy.org` |
| "8 variations with random seeds" | `run_batch.py --count 8 --randomize-seed --host https://cloud.comfy.org ...` |
| "show me live progress" | `ws_monitor.py --prompt-id <id> --host https://cloud.comfy.org` |
| "fetch the error from job X" | `fetch_logs.py <prompt_id> --host https://cloud.comfy.org` |
| "what's in the queue?" | `curl -H "X-API-Key: $COMFY_CLOUD_API_KEY" https://cloud.comfy.org/api/queue` |
| "cancel that" | `curl -X POST -H "X-API-Key: $COMFY_CLOUD_API_KEY" https://cloud.comfy.org/api/interrupt` |

## Image Upload (img2img / Inpainting)

The simplest way is `--input-image` with `run_workflow.py`:

```bash
python3 scripts/run_workflow.py \
  --workflow workflows/sdxl_img2img.json \
  --input-image image=./photo.png \
  --args '{"prompt": "make it cyberpunk", "denoise": 0.6}' \
  --host https://cloud.comfy.org
```

The flag uploads `photo.png`, then injects its server-side filename into
whatever schema parameter is named `image`. For inpainting, pass both:

```bash
python3 scripts/run_workflow.py \
  --workflow workflows/sdxl_inpaint.json \
  --input-image image=./photo.png \
  --input-image mask_image=./mask.png \
  --args '{"prompt": "fill with flowers"}' \
  --host https://cloud.comfy.org
```

Manual upload via REST:

```bash
curl -X POST "https://cloud.comfy.org/api/upload/image" \
  -H "X-API-Key: $COMFY_CLOUD_API_KEY" \
  -F "image=@photo.png" -F "type=input" -F "overwrite=true"
```

## Cloud Specifics

- **Base URL:** `https://cloud.comfy.org`
- **Auth:** `X-API-Key` header (or `?token=KEY` for WebSocket)
- **API key:** set `$COMFY_CLOUD_API_KEY` once and the scripts pick it up automatically
- **Output download:** `/api/view` returns a 302 to a signed URL; the scripts
  follow it and strip `X-API-Key` before fetching from the storage backend
  (don't leak the API key to S3/CloudFront).
- **Endpoint quirks vs. open-source ComfyUI:**
  - `/api/object_info`, `/api/queue`, `/api/userdata` — **403 on free tier**;
    paid only.
  - `/history` is renamed to `/history_v2` (the scripts route automatically).
  - `/models/<folder>` is renamed to `/experiment/models/<folder>` (the
    scripts route automatically).
  - `clientId` in WebSocket is currently ignored — all connections for a
    user receive the same broadcast. Filter by `prompt_id` client-side.
  - `subfolder` is accepted on uploads but ignored — cloud has a flat namespace.
- **Concurrent jobs:** Free/Standard: 1, Creator: 3, Pro: 5. Extras queue
  automatically. Use `run_batch.py --parallel N` to saturate your tier.
- **Pricing:** https://www.comfy.org/cloud/pricing

## Queue & System Management

```bash
HOST=https://cloud.comfy.org
HDR="X-API-Key: $COMFY_CLOUD_API_KEY"

curl -s -H "$HDR" "$HOST/api/queue" | python3 -m json.tool
curl -X POST -H "$HDR" "$HOST/api/queue" -d '{"clear": true}'   # cancel pending
curl -X POST -H "$HDR" "$HOST/api/interrupt"                     # cancel running
python3 scripts/fetch_logs.py --tail-queue --host "$HOST"
```

## Pitfalls

1. **API format required** — every script and the `/api/prompt` endpoint
   expect API-format workflow JSON. The scripts detect editor format
   (top-level `nodes` and `links` arrays) and tell you to re-export via
   "Workflow → Export (API)" (newer UI) or "Save (API Format)" (older UI).

2. **Model names are exact** — case-sensitive, includes file extension.
   `check_deps.py` does fuzzy matching (with/without extension and folder
   prefix), but the workflow itself must use the canonical name.

3. **Cloud free-tier API limits** — `/api/prompt`, `/api/view`, `/api/upload/*`,
   `/api/object_info` all return 403 on free accounts. `health_check.py`
   and `check_deps.py` handle this gracefully and surface a clear message.
   Workflow execution requires a paid subscription.

4. **Timeout for video/audio workflows** — auto-detected when an output
   node is `VHS_VideoCombine`, `SaveVideo`, etc.; the default jumps from
   300s to 900s. Override explicitly with `--timeout 1800`.

5. **Path traversal in output filenames** — server-supplied filenames are
   passed through `safe_path_join` to refuse anything escaping
   `--output-dir`. Keep this protection on — workflows with custom save
   nodes can produce arbitrary paths.

6. **Workflow JSON is arbitrary code** — custom nodes run Python on the
   cloud server, so submitting an unknown workflow has the same trust
   profile as `eval`. Inspect workflows from untrusted sources before
   running.

7. **Auto-randomized seed** — pass `seed: -1` in `--args` (or use
   `--randomize-seed` and omit the seed) to get a fresh seed per run.
   The actual seed is logged to stderr.

## Verification Checklist

Use `python3 scripts/health_check.py --host https://cloud.comfy.org` to
run the whole list at once. Manual:

- [ ] `COMFY_CLOUD_API_KEY` is exported and the account has paid tier
- [ ] `curl -H "X-API-Key: $COMFY_CLOUD_API_KEY" https://cloud.comfy.org/system_stats` returns JSON
- [ ] `/api/experiment/models/checkpoints` returns models
- [ ] Workflow JSON is in API format
- [ ] `check_deps.py` reports `is_ready: true` (or only `node_check_skipped`
      on free tier)
- [ ] Test run with a small workflow completes; outputs land in `--output-dir`
