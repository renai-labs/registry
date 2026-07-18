---
name: ren-agent-dev
description: >-
  Design and write agents — their system prompt, model choice, and skill / MCP
  dependency shape. Use when the user asks to build, configure, modify, or debug
  an agent.
metadata:
  icon: "https://cdn.renai.build/skill-icons/agent-dev.svg"
  tags:
    - code
    - ren
---

# Agent Dev

Agents are specialized AI assistants configured for specific tasks and workflows — a system prompt + model + dependencies (skills and MCPs). Design them as small atomic units so they compose cleanly, stay debuggable, and can be independently versioned or swapped.

> This skill is the **design judgment** — how to write the prompt, choose the model, and shape dependencies. Creating and versioning agents, attaching them to projects, scope, and every Ren CLI / registry operation live in [[ren-systems-architect]].

## Versioning discipline

An agent version is an immutable snapshot of the prompt, model, and the skill/MCP versions it depends on. **One new version = one logical change** — it keeps runs debuggable and lets you bisect a regression to a single edit. (How versions attach and auto-roll-forward: [[ren-systems-architect]].)

## Choosing the model

**Do not pick a model silently. Stop and ask the user before the agent is created.** Surface three options across the price/capability range (heavy / balanced / light) with a one-line trade-off each, enriched with `$/M input` + `$/M output` from the provider's public pricing. Suggested defaults: **Claude Opus 4.8** for heavy work, **Claude Sonnet 5** balanced, **Claude Haiku 4.5** for light/cheap. An agent can also inherit the pod default instead of naming a model. (The live model catalog and the create flag live in [[ren-systems-architect]].)

## Writing the prompt

- Keep it focused: **role → workflow → output format → rules.** The prompt is the spine; push detail into skills, not the prompt.
- Author anything over a few lines as a file, not inline — quotes, backticks, and code fences break inline JSON.
- See `references/prompt-writing.md` and `references/dependency-patterns.md`.

## Dependency shape

`skills` and `mcps` are **full-replace** sets — when you change deps you provide the complete list, not a delta. Track latest by default (auto-roll-forward); pin a specific version only to freeze a snapshot. Keep the dep set minimal and purposeful — every skill an agent carries is catalog surface it must reason about. See `references/dependency-patterns.md`.

## Iterate

Improve from real runs, not in the abstract:

1. Verify the agent's current state.
2. Watch a real run — find the wrong output.
3. Fix the failing thing: skill content for a capability gap, the prompt or dep set for behavior — one logical change per version.

To create or version the agent, attach it to a project, wire credentials, or add stores/triggers — all Ren operations — see [[ren-systems-architect]].
