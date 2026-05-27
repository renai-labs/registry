---
name: skill-dev
description: Author, edit, fork, and optimize skills — the modular capabilities (instructions plus optional scripts, references, and templates) an agent loads on demand when a task makes them relevant. Use when the user wants to create, update, improve, or debug a skill, or add a custom capability to an agent.
---

# Skill Dev

A skill is a modular capability that can be used by agents - packaged instructions plus optional resources (`scripts/`, `references/`, `templates/`) that the agent reaches for on its own, only when a task makes it relevant. The package is a folder with a `SKILL.md` (frontmatter + markdown body) at its root. The frontmatter `name` + `description` are all the agent sees up front, listed in its skill catalog; it loads the full body and any bundled files on demand through the native skill tool. That's the point: an agent can carry many skills and pay for none of their content until one is actually needed - composable capability that stays context-cheap.

Skills are version-controlled - every version is immutable; updating means publishing a new version. One new version = one logical change.

## Lifecycle in the manifested sandbox

When an agent that depends on a skill runs, the skill materializes under the specific project's `.opencode/skills/` inside the pod sandbox - git-sourced skills are cloned, uploaded skills are unpacked from a presigned S3 URL. The `SKILL.md` body lands in the agent's context; `scripts/` are executed (not loaded), `references/` are read only when the agent opens them, `templates/` are copied.

`requiredCredentials` (UPPER_SNAKE_CASE env names) **declare** the secrets the skill expects at runtime. At startup the pod resolves them from its vault stack (see [vaults-credentials-dev]) and injects the hits as env vars; an unresolved one is simply absent — the skill still materializes and loads, then fails when it reaches for the missing variable. The declaration is advisory, not a gate: it's surfaced as a session auth-requirement so the user can wire the credential, not enforced at compose time. Publishing a new version, or attaching a skill to an agent, bumps the pod manifest and fans out.

## 1. Reuse before authoring - three tiers, in order

1. **Reuse** an existing registry / org / user skill as-is.
2. **Fork** a close-enough registry skill into your scope and edit it - the baked-in domain knowledge is worth keeping.
3. **Author from scratch** only when neither fits.

Why search first: registry skills are battle-tested — they encode what already works against the real tool surface, so you don't reason a workflow from scratch and you inherit current, correct details (commands, schemas, gotchas) instead of guessing them. Authoring is the last resort, not the default.

```
ren skills search --query "<topic>" --sources user org registry --output json
ren skills get <id> --output json
ren skills versions data <id> <version> --format presigned   # download bundled files before deciding
```

Fork is a first-class operation - it copies a skill into the user's scope as an editable copy, leaving the original untouched:

```
ren skills copy <id> --name "my-variant"
```

## 2. Build via CLI

`ren skills create` uploads a local folder (it validates the SKILL.md frontmatter first). Materialize the folder, then point at it:

```
ren skills create /abs/path/to/my-skill \
  --name "Human-readable name" \
  --description "When this skill triggers and what it does" \
  --icon "✨" \
  --required-credentials @creds.json \
  --release-notes "Initial release"            # → skillId
```

New version replaces the full folder (no patch flow):

```
ren skills versions create skl_… /abs/path/to/my-skill --version patch --release-notes "…"
```

`--version` is `patch` (wording), `minor` (new sections/scripts), or `major` (renamed triggers / breaking). Metadata-only edits: `ren skills update <id> [--name …] [--description …]`.

## 3. Build via MCP

The MCP path takes files **inline** as JSON instead of a folder upload:

```
mcp__ren__skill_search  { "query": "<topic>", "sources": ["user","org","registry"] }
mcp__ren__skill_copy    { "id": "skl_…", "name": "my-variant" }
mcp__ren__skill_create  { "name": "…", "description": "…", "icon": "✨",
                          "requiredCredentials": [{ "name": "SLACK_BOT_TOKEN", "description": "…" }],
                          "files": [{ "path": "SKILL.md", "content": "---\nname: …\n---\n# …" }] }
mcp__ren__skill_version_create { "id": "skl_…", "version": "patch", "files": [{ "path": "SKILL.md", "content": "…" }] }
mcp__ren__skill_version_data   { "id": "skl_…", "version": "1", "format": "presigned" }
```

## 4. SKILL.md anatomy

```
---
name: my-skill-name        # lowercase, hyphens, ≤64 chars
description: Does X when Y # what it does AND when to trigger; ≤1024 chars
---

# Title
[1–2 sentence overview]

## Primary workflow
[Steps, commands, or templates]
```

`name` and `description` determine when the skill triggers - be specific about both.

## 5. Writing principles

1. **Stay under 500 lines.** Move depth into `references/`.
2. **Match specificity to fragility.** Open tasks → guidance; fragile sequences → exact scripts. See `references/workflows.md`.
3. **Provide defaults, not menus.** One recommended approach.
4. **Avoid duplication.** A fact lives in one place.

See `references/output-patterns.md` and `references/progressive-disclosure-patterns.md`.

## 6. requiredCredentials

UPPER_SNAKE_CASE secrets the skill needs at runtime. Per-version, full-replace - omit to inherit (update) or declare none (create). Only declare credentials the SKILL.md actually references. **Do not write credential-setup steps into SKILL.md** - assume the env var is present and use it; the platform injects it.

## 7. Bundled resources


| Resource      | Use for                            | Loaded into context? |
| ------------- | ---------------------------------- | -------------------- |
| `scripts/`    | Deterministic, repeated operations | No (executed)        |
| `references/` | Domain depth, schemas, long docs   | Only when read       |
| `templates/`  | Boilerplate output assets          | No                   |


## 8. Iterate

Ship → use → tighten. Don't anticipate every edge case in v1 - edit from real failures.

## Next steps

A skill does nothing until an agent depends on it.

- **Attach it to an agent** - add the `skillId` to the agent version's `skills: [{ skillId }]` list (pin a specific `skillVersionId` to freeze the version, or omit it to track the latest). Deps are full-replace and per-version, so `ren agents get` first and pass the union. See [agent-dev].
- **Authorize it** - if the skill declares `requiredCredentials`, get those secrets into the pod's vault so the env vars resolve at startup. See [vaults-credentials-dev].