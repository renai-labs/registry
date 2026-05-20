---
name: skill-dev
description: Author and edit custom skills (the prompt-shaped instructions agents follow). Use when the user asks to create, update, modify, or optimize a skill, or wants to add a custom capability to an agent.
---

# Skill Dev

Skills are prompt-based instructions that teach an agent how to do a specific thing. A skill is a folder with a `SKILL.md` (frontmatter + markdown body) and optional bundled `scripts/`, `references/`, `templates/`.

One new skill version = one logical change.

## 1. Reuse before authoring

Before writing anything new, decide in this order:

1. **Reuse** an existing registry / org / user skill if one already fits.
2. **Tweak** — fetch a close-enough existing skill, edit the folder, upload it as a new user/org skill.
3. **Author from scratch** only when neither of the above will do.

```
ren skills search --query "<topic>" --sources user org registry
ren skills search --query "<topic>" --sources user                  # narrow to your own
```

Read promising results with `ren skills get <id>` (metadata) and `ren skills versions data <id> <version> --format presigned` to download the bundled files before deciding to author new.

## 2. Create a skill

`ren skills create` uploads a local folder. Materialize the folder first (SKILL.md plus any bundled scripts / references / templates), then point the CLI at it.

```
ren skills create /abs/path/to/my-skill \
  --name "Human-readable name" \
  --description "When this skill triggers and what it does" \
  --icon "✨" \
  --required-credentials @creds.json \
  --release-notes "Initial release"
```

The CLI runs `skills-ref validate <folder>` before uploading. Returns the new `skillId`.

**requiredCredentials:** UPPER_SNAKE_CASE env-var secrets the skill needs at runtime. Pass JSON inline (`'[{"name":"SLACK_BOT_TOKEN","description":"…"}]'`) or via `@creds.json`. Per-version, full-replace — omit to inherit (on update) or declare none (on create). Only declare credentials the SKILL.md actually references.

The Ren platform handles provisioning: operators supply the values and the runtime injects them as env vars before the skill runs.

Do **not** write credential-setup instructions into `SKILL.md`. The skill body should assume the env var is already present and just use it.

## 3. New version

```
ren skills versions create skl_… /abs/path/to/my-skill \
  --version patch \
  --release-notes "…" \
  --required-credentials @creds.json
```

`--version` accepts `patch` (wording / clarifications), `minor` (new sections or scripts), or `major` (renamed triggers or breaking changes). The full folder contents replace the previous version — there is no patch flow.

For metadata-only edits (no file change), use `ren skills update <id> [--name …] [--description …] [--icon …]`.

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

`name` and `description` determine when the skill triggers — be specific about both.

## 5. Writing principles

1. **Stay under 500 lines.** Move depth into `references/`.
2. **Match specificity to fragility.** Open tasks → guidance. Fragile sequences → exact scripts. See `references/workflows.md`.
3. **Provide defaults, not menus.** One recommended approach, not five options.
4. **Avoid duplication.** A fact lives in one place only.

See `references/output-patterns.md` and `references/progressive-disclosure-patterns.md` for deeper guidance.

## 6. Bundled resources

| Resource      | Use for                              | Loaded into context? |
| ------------- | ------------------------------------ | -------------------- |
| `scripts/`    | Deterministic, repeated operations   | No (executed)        |
| `references/` | Domain depth, schemas, long docs     | Only when read       |
| `templates/`  | Boilerplate output assets            | No                   |

## 7. Read before editing

```
ren skills get skl_…
ren skills versions data skl_… <version> --format presigned
```

`get` returns `version`, `name`, `description`, `requiredCredentials`. `versions data` returns presigned URLs for the bundled files — download them, edit the folder on disk, then `ren skills versions create skl_… <folder>` to ship.

## 8. Iterate

Ship → use → tighten. Don't anticipate every edge case in v1 — edit from real failures.
