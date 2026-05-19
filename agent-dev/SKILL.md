---
name: agent-dev
description: Create, configure, and update agents — including their prompt, model, and skill / MCP dependencies. Use when the user asks to build, configure, modify, or debug an agent.
---

# Agent Dev

An agent is a system prompt + model + dependencies (skills and MCPs). One new version = one logical change to that bundle.

## Create

```
ren agents create --name "My Agent" --icon "🤖" --tags assistant ops
```

Creates the agent and an initial version in one call. Returns the new `agentId`. Use `ren agents update <id>` later to change metadata (`--name`, `--icon`, `--tags`).

## New version (prompt / model / deps change)

Scalar fields go on flags; nested fields (`skillIds`, `mcpIds`, version bump) go through `--body`:

```
ren agents versions create agt_… \
  --prompt "You are…" \
  --model "claude-sonnet-4-6" \
  --description "What this agent does" \
  --release-notes "…" \
  --body '{
    "skillIds": ["skl_…", "skl_…"],
    "mcpIds":   ["mcp_…"],
    "version":  "patch"
  }'
```

`--body` accepts a JSON string, `@file.json`, or `@-` for stdin. Scalar flags merge over `--body`.

`skillIds` and `mcpIds` are full-replace lists. Omit them to inherit the previous version's deps. To change deps, `ren agents get` first, modify the array, then ship a new version.

## Read

```
ren agents get agt_…
```

Returns `id`, `slug`, `name`, `icon`, latest `version`, `description`, `prompt`, `model`, `skills`, `mcps`.

## Discover

```
ren agents search --query "…" --sources user org registry
```

There is no separate `agents list` for cross-scope discovery — `agents search` is the listing primitive (default sources: user + org + registry).

## Dependencies

Deps are plain id arrays (`skillIds: string[]`, `mcpIds: string[]`). Discover ids with `ren skills search` / `ren mcps search`.

See `references/dependency-patterns.md` for anti-patterns.

## Model

- **Light** (single tool call, short reply, deterministic): `claude-haiku-4-5`.
- **Heavy** (multi-step reasoning, tool chaining, long-form drafting): `claude-sonnet-4-6`.
- Default to `claude-sonnet-4-6` when unsure. Pass `--model null` (via `--body '{"model":null}'`) to inherit the pod's default.

## Prompt

Aim for < 200 words. Role → workflow → output format → rules. Push detail into skills, not the prompt. See `references/prompt-writing.md`.

## Iterate

1. `ren agents get` — verify current state.
2. Watch a real run — identify the wrong output.
3. `ren skills versions create` to fix skill content, `ren agents versions create` to fix prompt or deps.
