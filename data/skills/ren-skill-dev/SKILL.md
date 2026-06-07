---
name: ren-skill-dev
description: >-
  Author, edit, fork, and optimize skills — the modular capabilities
  (instructions plus optional scripts, references, and templates) an agent loads
  on demand when a task makes them relevant. Use when the user wants to create,
  update, improve, or debug a skill, or add a custom capability to an agent.
metadata:
  icon: 'https://cdn.renai.build/skill-icons/skill-dev.svg'
  tags:
    - code
    - ren
---

# Skill Dev

A skill is a modular capability that can be used by agents - packaged instructions plus optional resources (`scripts/`, `references/`, `templates/`) that the agent reaches for on its own, only when a task makes it relevant. The package is a folder with a `SKILL.md` (frontmatter + markdown body) at its root. The frontmatter `name` + `description` are all the agent sees up front, listed in its skill catalog; it loads the full body and any bundled files on demand. That's the point: an agent can carry many skills and pay for none of their content until one is actually needed.

> Commands and flags: `ren docs commands`. Entities, scope, versioning: `ren docs model`. This skill is the authoring craft on top of those.

## Runtime behavior

`scripts/` run when the agent calls them; `references/` only load when the agent opens them; `templates/` are copied verbatim — so the SKILL.md body should be tight and the depth belongs in the bundled files. By default an agent tracks a skill's **latest** version and auto-rolls-forward (see `ren docs model` on versioning).

`requiredCredentials` (UPPER_SNAKE_CASE env names) **declare** the secrets the skill expects at runtime. The platform resolves them from the pod's vault stack and makes them available as env vars; an unresolved one is simply absent — the skill still loads, then fails when it reaches for the missing variable. The declaration is advisory: it surfaces a missing-auth prompt to the user, not a hard gate.

## Scope

Follows the Ren standard (`ren docs model`). Key constraint: a `user` skill can back a `user` or `org` agent, but you can't pull a narrower-scope skill into a broader-scope publication.

## 1. Reuse before authoring - three tiers, in order

1. **Reuse** an existing registry / org / user skill as-is.
2. **Fork** a close-enough registry skill into your scope and edit it - the baked-in domain knowledge is worth keeping.
3. **Author from scratch** only when neither fits.

Registry skills encode battle-tested commands, schemas, and gotchas — inherit them rather than reasoning from scratch. `ren skills list` shows only your own items; only `ren skills search --sources user org registry` reaches the registry. For *which* skill to reach for per task, see `ren docs integrations`.

Download a skill's bundled files before deciding whether to fork:

```
ren skills versions data <id> <version> --scope user --format presigned
```

Fork copies a skill into your scope as an editable copy, leaving the original untouched (`--scope user` to read a user-scope source; registry/org sources don't need it):

```
ren skills copy <id> --scope user --name "my-variant"
```

## 2. SKILL.md anatomy

```
---
name: my-skill-name        # lowercase, hyphens, ≤64 chars
description: Does X when Y # what it does AND when to trigger; ≤1024 chars
---

# Title
[1–2 sentence overview]

## Primary workflow
[Steps, commands, or templates]

## Gotchas
[Environment-specific facts that defy assumptions — the agent reads these before it errs]
```

`name` and `description` determine when the skill triggers, and the `description` carries the entire burden: only `name` + `description` load up front; the body loads on demand. Be specific about *what it does* AND *when to reach for it*. See `references/descriptions.md`.

## 3. Writing principles

1. **Stay lean — ≤500 lines / ~5,000 tokens.** Move depth into `references/`.
2. **Add what the agent lacks, omit what it knows.** Skip generic background; spend tokens on project conventions, non-obvious edge cases, and which tool/API to use.
3. **Match specificity to fragility.** Open tasks → guidance (explain *why*); fragile sequences → exact scripts. See `references/workflows.md`.
4. **Favor procedures over declarations.** Teach how to approach a class of problems, not the answer to one instance.
5. **Provide defaults, not menus.** One recommended approach; alternatives brief.
6. **Capture gotchas** in SKILL.md — concrete corrections to mistakes the agent will otherwise make. See `references/workflows.md`.
7. **Avoid duplication.** A fact lives in one place.

See `references/output-patterns.md` and `references/progressive-disclosure-patterns.md`.

## 4. requiredCredentials

UPPER_SNAKE_CASE secrets the skill needs at runtime. Per-version, full-replace - omit to inherit (update) or declare none (create). Only declare credentials the SKILL.md actually references. **Do not write credential-setup steps into SKILL.md** - assume the env var is present and use it; the platform injects it.

## 5. Bundled resources

| Resource      | Use for                            | Loaded into context? |
| ------------- | ---------------------------------- | -------------------- |
| `scripts/`    | Deterministic, repeated operations | No (executed)        |
| `references/` | Domain depth, schemas, long docs   | Only when read       |
| `templates/`  | Boilerplate output assets          | No                   |

See `references/bundled-resources.md` for the full decision matrix and — before writing any `scripts/` file — how to design scripts for agentic use (no Python: Bash/Node/Bun only).

## 6. Iterate

**Start from real expertise.** Generic LLM knowledge yields vague procedures ("handle errors appropriately"). Ground the skill in specifics: extract the pattern from a real task you completed with an agent (steps that worked, corrections you made, project facts you supplied), or synthesize from your own runbooks, schemas, and the patches that actually fixed things.

**Then refine with real execution.** Ship → use → tighten. Read a session's *execution trace*, not just the output — wasted steps usually mean instructions too vague, inapplicable, or lacking a default. Fix the failing step, bump the version; every hand correction is a gotcha to add. Don't anticipate every edge case in v1 — edit from real runs.

## Next steps

A skill does nothing until an agent uses it inside a project.

- **Attach to an agent** — add the `skillId` to the agent version's `skills: [{ skillId }]` list. See [[ren-agent-dev]] for attach details and the full-replace dep pattern.
- **Wire its credentials** if the skill declares `requiredCredentials`. See [[ren-vaults-credentials-dev]].
- **Put the agent in a project** so a session can actually call the skill. See [[ren-project-dev]].
