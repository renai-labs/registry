---
name: skill-dev
description: Author and edit custom skills (the prompt-shaped instructions agents follow). Use when the user asks to create, update, modify, or optimize a skill, or wants to add a custom capability to an agent.
---

# Skill Dev

Skills are prompt-based instructions that teach an agent how to do a specific thing. A skill is a folder with a `SKILL.md` (frontmatter + markdown body) and optional bundled `scripts/`, `references/`, `templates/`.

One `ren_skill_upsert` call = one logical change = one new version.

## 1. Reuse before authoring

Before writing anything new, decide in this order:

1. **Reuse** an existing registry / org / user skill if one already fits.
2. **Tweak** — fetch a close-enough existing skill, edit the folder, upload it as a new user/org skill.
3. **Author from scratch** only when neither of the above will do.

```
ren_search { type: "skill", query: "<topic>" }              // default: user + org + registry
ren_search { type: "skill", owners: ["user"] }              // narrow to your own
```

Read promising results with `ren_skill_get { skillId, includeFiles: true }` before deciding to author new.

## 2. Write or edit a skill

`ren_skill_upsert` uploads a skill folder from disk. Materialize the folder first (SKILL.md plus any bundled scripts / references / templates), then point the tool at the absolute path.

```
ren_skill_upsert {
  skillId:      "skl_…",                          // omit to create; pass to update
  owner:        "user",                           // "user" (default) or "org"
  path:         "/abs/path/to/my-skill",          // folder containing SKILL.md
  name:         "Human-readable name",            // required when creating
  description:  "When this skill triggers and what it does",
  icon:         "✨",                              // optional, emoji or URL
  versionBump:  "patch",                          // patch | minor | major (updates only)
  releaseNotes: "…"                               // optional
}
```

Identity is by `skillId`. To create, omit `skillId` and pass `name`. The tool runs `skills-ref validate <path>` before uploading. The full folder contents replace the previous version — there is no patch flow.

**versionBump:** `patch` = wording/clarifications · `minor` = new sections or scripts · `major` = renamed triggers or breaking changes.

## 3. SKILL.md anatomy

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

## 4. Writing principles

1. **Stay under 500 lines.** Move depth into `references/`.
2. **Match specificity to fragility.** Open tasks → guidance. Fragile sequences → exact scripts. See `references/workflows.md`.
3. **Provide defaults, not menus.** One recommended approach, not five options.
4. **Avoid duplication.** A fact lives in one place only.

See `references/output-patterns.md` and `references/progressive-disclosure-patterns.md` for deeper guidance.

## 5. Bundled resources

| Resource      | Use for                              | Loaded into context? |
| ------------- | ------------------------------------ | -------------------- |
| `scripts/`    | Deterministic, repeated operations   | No (executed)        |
| `references/` | Domain depth, schemas, long docs     | Only when read       |
| `templates/`  | Boilerplate output assets            | No                   |

## 6. Read before editing

```
ren_skill_get { skillId: "skl_…", includeFiles: true }
```

Returns `version`, `content` (SKILL.md body), and bundled files when `includeFiles: true`. Note: `ren_skill_get` takes no `owner` — registry skills are discoverable via search but their bundled files are not returned through `get`. Materialize the returned files to disk, edit, then `ren_skill_upsert` pointing at the folder.

## 7. Iterate

Ship → use → tighten. Don't anticipate every edge case in v1 — edit from real failures.
