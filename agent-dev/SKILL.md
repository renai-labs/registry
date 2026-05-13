---
name: agent-dev
description: Create, configure, and update agents — including their prompt, model, and skill / MCP dependencies. Use when the user asks to build, configure, modify, or debug an agent.
---

# Agent Dev

An agent is a system prompt + model + dependencies (skills and MCPs). One `ren_agent_upsert` call = one logical change = one new version.

## Create or update

```
ren_agent_upsert {
  agentId:     "agt_…",                  // omit to create; pass to update
  owner:       "user",                   // "user" (default) or "org" — see Ownership
  name:        "My Agent",               // required when creating
  description: "What this agent does",   // optional
  icon:        "🤖",                     // optional, emoji or URL
  prompt:      "You are…",               // new version's system prompt
  model:       "claude-sonnet-4-6",      // optional; pass null to inherit the pod default
  skillIds:    ["skl_…", "skl_…"],       // full replace; omit to inherit previous list
  mcpIds:      ["mcp_…"],                // full replace; omit to inherit previous list
  versionBump: "patch",                  // patch | minor | major
  releaseNotes:"…"                       // optional
}
```

Identity is by `agentId`. To create, omit `agentId` and pass `name`. To update, pass `agentId` and only the fields you want to change.

`skillIds` and `mcpIds` are full-replace lists. Omitting them inherits the previous version's deps. To change deps, `ren_agent_get` first, modify the array, then upsert.

## Read

```
ren_agent_get { agentId: "agt_…", owner: "user" }
```

Returns `id`, `slug`, `name`, `icon`, latest `version`, `description`, `prompt`, `model`, `skills`, `mcps`.

## Discover

```
ren_search { type: "agent", query: "…", owners: ["user", "org", "registry"] }
```

There is no dedicated `agent_list` tool. Use `ren_search` (default scope: user + org + registry).

## Ownership

`owner` controls the access scope of the call:

- `user` (default) — your personal agents and any org-wide ones you can see.
- `org` — org-wide only.

Pass the wrong scope on an existing `agentId` and the server returns not-found. There is no `registry` scope on writes — registry items are read-only catalog entries you reference by id, not author into.

## Dependencies

Deps are plain id arrays (`skillIds: string[]`, `mcpIds: string[]`). The scope of each dep is irrelevant to the agent — the id is enough. Discover ids with `ren_search`.

See `references/dependency-patterns.md` for anti-patterns.

## Model

- **Light** (single tool call, short reply, deterministic): `claude-haiku-4-5`.
- **Heavy** (multi-step reasoning, tool chaining, long-form drafting): `claude-sonnet-4-6`.
- Default to `claude-sonnet-4-6` when unsure. Pass `model: null` to inherit the pod's default.

## Prompt

Aim for < 200 words. Role → workflow → output format → rules. Push detail into skills, not the prompt. See `references/prompt-writing.md`.

## Iterate

1. `ren_agent_get` — verify current state.
2. Watch a real run — identify the wrong output.
3. `ren_skill_upsert` to fix skill content, `ren_agent_upsert` to fix prompt or deps.
