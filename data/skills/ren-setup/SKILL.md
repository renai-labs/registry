---
name: ren-setup
description: >-
  Topology- and loop-based setup that designs and provisions a full Ren
  agent-stack from an interview. Run when a user wants to build out or expand
  their stack beyond a single agent, or when ren-onboarding hands off after the
  first agent. Authors a desired-state topology.json, renders it to a canvas,
  diffs it against live, and builds the gap leaf-up until they match.
metadata:
  tags:
    - ren
---

# Ren Setup

This skill turns an interview into a **running Ren agent-stack**. It drives the **blueprint loop** — author a desired-state `topology.json`, render it so the user *watches* their setup form, diff it against live, build the gap, repeat until they match. Use it to build a multi-agent stack from scratch, or to expand a stack that [[ren-onboarding]] started with one agent.

The on-disk draft is the source of truth — re-read it every iteration instead of trusting context, so the loop survives context bloat and weaker models.

## Load fundamentals first

Before building, load **[[ren-systems-architect]]** — it owns the Ren manual (data model, scope tiers, reuse-before-create, the leaf-up build chain, credentials design, pod/project arrangement) and every Ren CLI / registry mutation. This skill is **only** the topology + loop on top; defer all primitive and build-chain decisions to the architect. **Read it; don't recite it to the user.**

Then pull the one CLI reference the architect doesn't carry and keep it handy:

- `ren docs commands > /tmp/ren-commands.txt` — the full command tree, every command and flag (CLI transport; MCP transport exposes the same surface as `mcp__ren__*` tools).

## Pick a transport

How you drive the loop depends on where you're running:

- **Coding-agent environment (has a shell)** → install/use the CLI (`npm install -g @renai-labs/cli`, then `ren <cmd>`) and run the scripted loop below.
- **Ren MCP connected** (`mcp__ren__*` tools) or any **no-shell** host → run the *same* loop **by hand**: author and self-validate the draft against `assets/topology.schema.json`, reconcile by reading live state directly (the same entity reads `diff.ts` would make), and hand the live Ren UI link instead of the canvas. The scripts need a shell + `bun` — don't invoke them here.

Authentication and the device flow, if not already paired, are owned by [[ren-onboarding]] / the architect — this skill assumes a working transport.

## Read before you draft

If [[ren-onboarding]] already gathered the user's memory and intake, reuse it. Otherwise pull it now (architect / onboarding cover the mechanics): what they do, who they work with, what they keep repeating, what they've already automated. The stack you design has to map to their **real** recurring work, not a generic template. Summarise what you know in 2–3 crisp sentences before proposing a topology.

## The blueprint loop

Full procedure, requirement kinds, working-file paths, and script runtime deps: `references/blueprint.md`. The loop in brief:

```
author topology.json → render (scripts/render.ts) → ren topology get → diff (scripts/diff.ts)
   → build the gap (architect's chain) → write back ids → re-render → repeat until clean
```

1. **Author the draft** at `/tmp/ren-topology.json`, conforming to `assets/topology.schema.json`. Set the required `meta.org` / `meta.orgId`, key every entity by `slug` (omit `id` until provisioned), and turn each "this must be true" into a `projects[].requirements[]` entry (`kind` / `must` / referenced slug / `blocking` / `verify`). **Seed it with what you're reusing** — the private pod and the default vault / file / memory stores (architect's reuse-before-create inventory) — so the diff stays quiet.
2. **Render** so the user sees the stack they're about to get: `bun run <skill-dir>/scripts/render.ts /tmp/ren-topology.json`. Opens `/tmp/ren-canvas.html`. Headless/sandbox: hand the written path, or skip to the live link. No-shell transport: render by hand isn't possible — hand the live Ren UI link instead.
3. **Fetch live** — `ren topology get --output json` (CLI) or `topology_get` (MCP).
4. **Diff** — `bun run <skill-dir>/scripts/diff.ts /tmp/ren-topology.json`. The `--- machine ---` block is the worklist: entities to build, drift to reconcile, and each requirement as pass / fail / blocked / manual.
5. **Build the gap** — run the **architect's build chain** leaf-up (`references/operations.md` / `references/wiring.md`), reuse-before-create as always. Write each new `id` back into the draft next to its slug. Honour `blockedBy`.
6. **Re-render and repeat** until the diff is clean and every blocking requirement passes. The diff worklist — not the picture — is the authority on what's left. Show the converged canvas at hand-off.

- **Stay in `--scope user`** and build inside the user's **private pod** and **fresh projects** (one per outcome) unless the user explicitly wants something shared. Scope rules: architect.

## Narrate in the user's register

The user's camp (builder vs consumer — see [[ren-onboarding]]) tells you which register to speak. Same action, different words:

| Action                | Builder register                                 | Consumer register                                                                                        |
| --------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Fork a registry skill | "Forking `skl_…` into your user scope"           | "Pulling the github-pr-review skill from the registry — same one a few teams use as their default"       |
| Attach a memory store | "Creating a memory store, mounting rw"           | "Giving the agent a notepad it can write to between runs, so next week it picks up where today left off" |
| Wire a credential     | "Resolving GITHUB_TOKEN from your default vault" | "Wiring your GitHub access once — every agent in this pod uses it, no re-pasting"                        |

## Credentials — the decision

When the build chain reaches an auth step, stop and ask with the **native question tool**: *connect now, or start incomplete and wire from inside the chat?* Default is **connect now**. The OAuth / API-key choreography lives in [[ren-vaults-credentials-dev]]; the design (vault scope, resolution, env-var injection) lives in [[ren-systems-architect]]. Native integrations are org-level: [[ren-github]] to install the org's GitHub App and mount a repo, [[ren-slack]] to route a channel to a project.

## Hand off

Land the user in a chat that loads, against the stack you built.

1. **Sandbox ready** — `ren pods sandboxes status <pod-id>`; if `absent`, `provision` and poll to `ready` (architect / `references/wiring.md`).
2. **Session** — `session.create` is SDK / web-app only. If your transport wraps the SDK, create the session and deep-link it; otherwise hand the project page and tell them to click "New session".
3. **URL** — default to the Ren UI deep link: `<base>/pods/<podId>/projects/<projectId>/sessions/<sessionId>` (base = `${REN_APP_URL}` when a shell resolves it, else `https://renai.build/app` — never a `localhost` link on a no-shell transport).

Show the converged canvas alongside the link. Close with one nudge in their register — a cron routine, a shared replay (`ren replays share <id>`), or the next agent in the stack.

## References

- `references/blueprint.md` — the desired-state spec, canvas, and diff reconcile loop in full, with the bundled `assets/topology.schema.json` / `assets/canvas.html` and the `scripts/render.ts` / `scripts/diff.ts` helpers.
- [[ren-systems-architect]] — the data model, scope rules, reuse inventory, leaf-up build chain, and every Ren mutation the loop calls.
