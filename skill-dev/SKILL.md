---
name: skill-dev
description: Author and edit custom skills (the prompt-shaped instructions agents follow). Use when the user asks to create, update, modify, or optimize a skill, or wants to add a custom capability to an agent.
---

# Skill Dev

Skills are prompt-based instructions that teach an agent how to do a specific thing. A skill is a folder with a `SKILL.md` (frontmatter + markdown body) and optional bundled `scripts/`, `references/`, `templates/`.

One `ren_skill_save` call = one logical change = one new version.

## 1. Find before you write

```
ren_search { type: "skill", sources: ["user"] }    // list all your skills
ren_search { type: "skill", query: "<topic>" }     // find by topic across all sources
```

Read promising user/org results with `ren_skill_get { slug }` before writing a new skill. Registry skills are discoverable but not readable — use them as conceptual reference only.

## 2. Write or edit a skill

```
ren_skill_save {
  slug: "my-skill",
  scope: "user",                    // or "org"
  name: "Human-readable name",      // required on first create
  description: "When this skill triggers and what it does",
  content: "<entire SKILL.md — frontmatter + markdown>",
  files: [
    { path: "scripts/foo.py",      content: "..." },
    { path: "references/bar.md",   content: "..." }
  ],
  versionBump: "patch"              // patch | minor | major
}
```

Send the complete `content` every time — new version replaces the previous one entirely.

**versionBump:** `patch` = wording/clarifications · `minor` = new sections or scripts · `major` = renamed triggers or breaking changes

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
ren_skill_get { slug }
```

Returns `content` (SKILL.md body). Pass `includeFiles: true` for bundled files. Compose the full updated content, then `ren_skill_save`.

## 7. Iterate

Ship → use → tighten. Don't anticipate every edge case in v1 — edit from real failures.
