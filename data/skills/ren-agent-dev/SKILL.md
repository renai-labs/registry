---
name: ren-agent-dev
description: >-
  Create, configure, and update agents — their prompt, model, and skill / MCP
  dependencies. Use when the user asks to build, configure, modify, or debug an
  agent.
metadata:
  icon: 'https://cdn.renai.build/skill-icons/agent-dev.svg'
  tags:
    - code
    - ren
---

# Agent Dev

Agents are specialized AI assistants configured for specific tasks and workflows — a system prompt + model + dependencies (skills and MCPs). Design them as small atomic units so they compose cleanly, stay debuggable, and can be independently versioned or swapped.

> Commands and flags (`agents create`, `agents versions create`, `agents get`, `agents search`): `ren docs commands`. Versioning, scope, and how attachments roll forward: `ren docs model`. This skill is the judgment on top.

## Runtime behavior

An agent version is an immutable snapshot of the prompt, model, and skill/MCP versions it depends on. By default a project attaches to the agent's **latest** version and auto-rolls-forward; pin a specific `agentVersionId` on attach ([[ren-project-dev]]) only to freeze a snapshot. One new version = one logical change.

## Scope

Follows the Ren standard (`ren docs model`). Pass `--scope user` on every command when the agent lives in your user namespace; `search` is the exception (it uses `--sources`).

## Choosing the model

**Do not pick a model silently. Stop and ask the user before creating the agent.**
Run `ren models list --output json` to get the live catalog — Ren supports models from many providers; the full list is always in the catalog. From that list, surface three options across the price/capability range (heavy / balanced / light) with a one-line trade-off each. Suggested defaults: **Claude Opus 4.7** for heavy work, **Claude Sonnet 4.6** balanced, **Claude Haiku 4.5** for light/cheap. Enrich each with `$/M input` + `$/M output` from the provider's public pricing. Pass `--model null` (via `--body '{"model":null}'`) to inherit the pod default.

## Easy to miss

- Pass the prompt via `--body @file.json` for anything over a few lines — inline JSON breaks on quotes, backticks, and code fences.
- `skills` / `mcps` are **full-replace** lists of `{ skillId }` / `{ mcpId }` objects. To add one skill, `ren agents get` first and pass the union. Omit `skillVersionId` to track latest (auto-roll-forward); pin it only to freeze.
- Keep the prompt focused: role → workflow → output format → rules. Push detail into skills, not the prompt. See `references/prompt-writing.md` and `references/dependency-patterns.md`.

## Iterate

1. `ren agents get` — verify current state.
2. Watch a real run — find the wrong output.
3. `ren skills versions create` to fix skill content, `ren agents versions create` to fix prompt or deps.

## Next steps

An agent does nothing until a project routes to it.

- **Attach to a project** as `primary` so chat sessions and triggers route to it. See [[ren-project-dev]].
- **Wire its credentials** if any skill or MCP it depends on needs auth. See [[ren-vaults-credentials-dev]] (and [[ren-mcp-dev]] for OAuth).
- **Give it persistent context** with a memory store, or feed it artifacts via a file store. See [[ren-file-memory-store-dev]].
- **Run it on a schedule** once a session works manually. See [[ren-trigger-dev]].
