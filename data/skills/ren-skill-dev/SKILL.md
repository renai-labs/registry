---
name: ren-skill-dev
description: >-
  Author, edit, fork, optimize, and adapt skills — the modular capabilities
  (instructions plus optional scripts, references, and assets) an agent loads
  on demand when a task makes them relevant. Use when the user wants to create,
  update, improve, or debug a skill, adapt a third-party / community SKILL.md,
  or add a custom capability to an agent.
metadata:
  icon: "https://cdn.renai.build/skill-icons/skill-dev.svg"
  tags:
    - code
    - ren
---

# Skill Dev

A skill is a modular capability that can be used by agents - packaged instructions plus optional resources (`scripts/`, `references/`, `assets/`) that the agent reaches for on its own, only when a task makes it relevant. The package is a folder with a `SKILL.md` (frontmatter + markdown body) at its root. The frontmatter `name` + `description` are all the agent sees up front, listed in its skill catalog; it loads the full body and any bundled files on demand. That's the point: an agent can carry many skills and pay for none of their content until one is actually needed.

> This skill is the **authoring craft** — how to write a skill well, whether from scratch or by adapting an existing one. Forking, publishing, attaching to agents, scope, versioning, and every Ren CLI / registry operation live in [[ren-systems-architect]].

## Two ways to start — pick one first

Every skill is created one of two ways. Decide which before you write anything:

1. **From scratch** — a blank `SKILL.md`. Write the frontmatter and body from real expertise; follow the anatomy, writing principles, and bundled-resource guidance below.
2. **Fork / adapt** — start from an existing skill (a registry skill you want a variant of, or a third-party / community `SKILL.md`) and edit it down to fit Ren. This is **copy first, then migrate** — two distinct steps, and the copy step is the one people skip.

### Forking is copy → migrate

A skill **is its folder**: the `SKILL.md` plus any `scripts/`, `references/`, `assets/` beside it. The "data" is not just the SKILL.md body — it's the whole directory. So forking starts by duplicating that directory, not by opening one file.

1. **Copy the whole folder to a new slug.** Never edit in place.
   - Registry skill → `cp -r data/skills/<source-slug>/ data/skills/<new-slug>/`
   - Community source (a local dir or a cloned git repo) → copy the folder that holds `SKILL.md` (with its bundled `scripts/` / `references/` / `assets/`) into `data/skills/<new-slug>/`; leave the repo's other files behind.
2. **Make the name match the folder.** Rename the new folder to `<new-slug>` if needed and set frontmatter `name: <new-slug>` — `name` **must equal the folder basename**.
3. **Migrate the copy.** Walk it through the **Adapting an existing skill** section below (full steps in `references/adapting-skills.md`) — minimum-surface edits that satisfy Ren's runtime model and frontmatter spec. Operate only on the copy; never touch the source.

Both paths converge on the same craft — everything below applies to whichever you chose.

## Runtime behavior — it shapes how you write

`scripts/` run when the agent calls them; `references/` only load when the agent opens them; `assets/` (templates, images, data files) ship alongside but never load into context — so the SKILL.md body should be tight and the depth belongs in the bundled files.

`requiredCredentials` (UPPER_SNAKE_CASE env names) **declare** the secrets the skill expects at runtime. The declaration is advisory — it surfaces a missing-auth prompt rather than hard-gating — and an unresolved secret is simply absent, so the skill still loads then fails at the call site. How secrets are resolved and wired: [[ren-vaults-credentials-dev]].

## SKILL.md anatomy & frontmatter spec

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

`name` and `description` determine when the skill triggers, and the `description` carries the entire burden: only `name` + `description` load up front; the body loads on demand. Be specific about _what it does_ AND _when to reach for it_. See `references/descriptions.md`.

Frontmatter is validated against a **strict** top level — only these keys are allowed:

| Key             | Rule                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | **required.** kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤64 chars, **must equal the skill's folder name.**                               |
| `description`   | **required.** 1–1024 chars.                                                                                                             |
| `license`       | optional string (SPDX id).                                                                                                              |
| `compatibility` | optional string, ≤500 chars.                                                                                                            |
| `allowed-tools` | optional string.                                                                                                                        |
| `metadata`      | optional open map. Ren extras live here: `author`, `source`, `homepage`, `icon`, `docUrl`, `tags` (kebab slugs), `requiredCredentials`. |

Any other top-level key fails validation — **notably `version`**. Ren owns versioning; never put `version` in frontmatter, and don't relocate it to `metadata.version` either.

## Writing principles

1. **Stay lean — ≤500 lines / ~5,000 tokens.** Move depth into `references/`.
2. **Add what the agent lacks, omit what it knows.** Skip generic background; spend tokens on project conventions, non-obvious edge cases, and which tool/API to use.
3. **Match specificity to fragility.** Open tasks → guidance (explain _why_); fragile sequences → exact scripts. See `references/workflows.md`.
4. **Favor procedures over declarations.** Teach how to approach a class of problems, not the answer to one instance.
5. **Provide defaults, not menus.** One recommended approach; alternatives brief.
6. **Capture gotchas** in SKILL.md — concrete corrections to mistakes the agent will otherwise make. See `references/workflows.md`.
7. **Avoid duplication.** A fact lives in one place.

See `references/output-patterns.md` and `references/progressive-disclosure-patterns.md`.

## requiredCredentials

UPPER_SNAKE_CASE secrets the skill needs at runtime. Per-version, full-replace - omit to inherit (update) or declare none (create). Only declare credentials the SKILL.md actually references. **Do not write credential-setup steps into SKILL.md** - assume the env var is present and use it; the platform injects it.

## Bundled resources

| Resource      | Use for                                          | Loaded into context? |
| ------------- | ------------------------------------------------ | -------------------- |
| `scripts/`    | Deterministic, repeated operations               | No (executed)        |
| `references/` | Domain depth, schemas, long docs                 | Only when read       |
| `assets/`     | Static resources — templates, images, data files | No                   |

See `references/bundled-resources.md` for the full decision matrix and — before writing any `scripts/` file — how to design scripts for agentic use (no Python: Bash/Node/Bun only).

## Adapting an existing skill — fork or community source

Once you've copied the source (see "Two ways to start" above), migrate the copy. It's minimum-surface work: keep the source's wording, examples, headings, and structure; edit only what conflicts with Ren's runtime model or fails the frontmatter spec — never the source.

The full step-by-step lives in **`references/adapting-skills.md`**: frontmatter reshaping, credential / MCP / file-store / memory-store rewrites, bundled-resource layout, assistant-identity stripping, attribution, the hard rules, and a before/after table. Read it before touching the copy.

## Iterate

**Start from real expertise.** Generic LLM knowledge yields vague procedures ("handle errors appropriately"). Ground the skill in specifics: extract the pattern from a real task you completed with an agent (steps that worked, corrections you made, project facts you supplied), or synthesize from your own runbooks, schemas, and the patches that actually fixed things.

**Then refine with real execution.** Ship → use → tighten. Read a session's _execution trace_, not just the output — wasted steps usually mean instructions too vague, inapplicable, or lacking a default. Fix the failing step, bump the version; every hand correction is a gotcha to add. Don't anticipate every edge case in v1 — edit from real runs.

## Verify before reporting done

- `name` equals the folder basename and is kebab-case ≤64 chars.
- `description` is 1–1024 chars.
- No top-level key outside { `name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata` } — especially no `version`.
- `metadata.tags` (if any) are kebab slugs; `metadata.requiredCredentials[].name` match `^[A-Z_][A-Z0-9_]*$`.
- Inside the ren registry repo, `bun run validate` confirms frontmatter early.

To fork, publish, attach the skill to an agent, or wire its credentials — all Ren operations — see [[ren-systems-architect]].
