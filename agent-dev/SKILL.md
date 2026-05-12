---
name: agent-dev
description: Create, configure, and update agents — including their prompt, model, and skill / MCP dependencies. Use when the user asks to build, configure, modify, or debug an agent.
---

# Agent Dev

An agent is a system prompt + model + dependencies (skills and MCPs). One `ren_agent_save` call = one logical change.

## Create or update

```
ren_agent_save {
  slug: "my-agent",
  owner: "user",               // or "org"
  name: "My Agent",            // required on first create
  prompt: "You are…",
  model: "claude-opus-4-7",    // optional
  skills: [{ slug: "code-review", owner: "registry" }],
  mcps:   [{ slug: "github",      owner: "registry" }],
  versionBump: "patch"         // patch | minor | major
}
```

`skills` and `mcps` replace the full list — omit to keep existing deps. Fetch current state with `ren_agent_get { slug }` before merging.

## Read before editing

```
ren_agent_get { slug }
```

Returns prompt, model, and current dep list.

## Dependencies

Each dep: `{ slug, owner }`. See `references/dependency-patterns.md` for anti-patterns.

## Prompt

Aim for < 200 words. Role → workflow → output format → rules. Push detail into skills, not the prompt. See `references/prompt-writing.md`.

## Iterate

1. `ren_agent_get` — verify current state.
2. Watch a real run — identify the wrong output.
3. `ren_skill_save` to fix skill content, `ren_agent_save` to fix prompt or deps.
