---
name: agent-dev
description: Create, configure, and update agents — their prompt, model, and skill / MCP dependencies. Use when the user asks to build, configure, modify, or debug an agent.
---

# Agent Dev

An agent is a system prompt + model + dependencies (skills and MCPs). Agents are version-controlled. Every version is immutable — you never edit a published version in place. Updating an agent means publishing a new version that replaces the previous one. One new version = one logical change to that bundle.

## Lifecycle in the manifested sandbox

An agent is a reusable blueprint (one slug per org); an **agent version** is the published snapshot with the baked-in prompt, model, and **pinned** skill/MCP versions. When the agent is attached to a project, that version is pinned too — newer versions don't auto-roll-forward.

At sandbox compose time the version becomes the project's `opencode.json`: the prompt is injected (along with current time, timezone, and the mounted volume paths), and the model resolves to `litellm/<name>` so it runs through the pod's per-sandbox LiteLLM key — that's how any model at any price tier works without a config change. Skills materialize under the project's `.opencode/skills/`; MCP credentials are injected from the vault. The project's **primary** agent is what triggers and chat sessions route to; **subagents** are called from within. Publishing a new version bumps the pod manifest and fans out.

Favor many small specialists composing over one giant agent — easier to version, swap models for, and debug.

## Build via CLI

`agents create` makes the agent and its first version (`0.0.1`) in one call:

```
ren agents create --name "My Agent" --icon "🤖" --prompt "You are…" --model "claude-sonnet-4-6"   # → agentId
```

It takes the same version fields as a bump (`--prompt`, `--model`, `--description`, `--release-notes`, plus `skills`/`mcps` via `--body`); omit them to start from an empty first version. New version (scalar fields on flags; nested fields via `--body`):

```
ren agents versions create agt_… \
  --prompt "You are…" \
  --model "claude-sonnet-4-6" \
  --release-notes "…" \
  --body '{
    "skills": [{ "skillId": "skl_…" }, { "skillId": "skl_…" }],
    "mcps":   [{ "mcpId": "mcp_…" }],
    "version": "patch"
  }'
```

`--body` accepts a JSON string, `@file.json`, or `@-`. Scalar flags merge over `--body`. Read with `ren agents get agt_…`; discover across scopes with `ren agents search --query "…" --sources user org registry` (there is no separate `agents list`).

## Build via MCP

```
mcp__ren__agent_create         { "name": "My Agent", "icon": "🤖", "prompt": "…", "model": "claude-sonnet-4-6" }
mcp__ren__agent_version_create { "id": "agt_…", "prompt": "…", "model": "claude-sonnet-4-6",
                                 "skills": [{ "skillId": "skl_…" }], "mcps": [{ "mcpId": "mcp_…" }] }
mcp__ren__agent_get            { "id": "agt_…" }
mcp__ren__agent_search         { "query": "…", "sources": ["user","org","registry"] }
```

## Choosing the model — surface options, don't pick silently

Pull the catalog, then offer **three options across the price/capability range** rather than choosing for the user:

```
ren models list --output json
```

- a **heavier** model for involved work (long reasoning, code, multi-step research),
- a **balanced** default (recommend this one),
- a **lighter/cheaper** option for summaries or routing.

Pricing isn't on the endpoint — enrich from the provider's public pricing and show `$/M input` + `$/M output` alongside each. Match the spread to the task. Pass `--model null` (via `--body '{"model":null}'`) to inherit the pod default.

## Easy to miss

- Pass the prompt via `--body @file.json` for anything over a few lines — inline JSON breaks on quotes, backticks, and code fences.
- `skills` / `mcps` are **full-replace** lists of `{ skillId }` / `{ mcpId }` objects (skills may pin `skillVersionId`). To add one, `ren agents get` first and pass the union; omit to inherit the previous version's deps.
- Keep the prompt focused: role → workflow → output format → rules, with failure modes next to the decisions they govern. Push detail into skills, not the prompt. See `references/prompt-writing.md` and `references/dependency-patterns.md`.

## Iterate

1. `ren agents get` — verify current state.
2. Watch a real run — find the wrong output.
3. `ren skills versions create` to fix skill content, `ren agents versions create` to fix prompt or deps.
