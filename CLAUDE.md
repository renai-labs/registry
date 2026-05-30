# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure (brief)

Registry monorepo for Ren skills, built with **Bun** (`bun@1.3.11`).

- `data/` — **source of truth.** Skills live at `data/skills/<slug>/SKILL.md` (+ assets); `data/skills.json` is the registry snapshot; `data/{agents,mcp_servers,tags}.json` are flat registries.
- `skills/`, `plugins/ren/skills/` — **generated mirrors** of `data/skills/`. `plugins/.../plugin.json`, `marketplace.json`, `skills.sh.json` — **generated manifests.**
- `cli/` — the `ren-registry` CLI (commander; logic in `cli/src/lib/`). `schemas/` — shared Zod schemas (`@renai-labs/registry-schemas`).

## Dos & Don'ts

- **DO** edit skills only under `data/skills/<slug>/`. **DON'T** hand-edit `skills/`, `plugins/ren/skills/`, or any generated manifest — `ren-registry build` overwrites them and `check` fails on drift.
- **DON'T** hand-edit `currentVersion`, `contentHash`, or `versions[]` in `data/skills.json` — these are owned by `release`/`publish`. **DON'T** put `version:` in SKILL.md frontmatter (frontmatter is `.strict()`); bump versions via `ren-registry release`.
- **DON'T** mutate or delete a frozen version (one whose `gitRef !== null`) — it's published and immutable; `check` rejects PRs that do.
- **DO** run `ren-registry build && git add -A` after a release so generated files stay in sync.
- **DO** add a new skill's slug to a `skills.sh.json` grouping only if it should ship in the bundled plugin (build prunes dead bundle entries but never auto-adds).

## Where each field is edited

- **In SKILL.md frontmatter** (pulled into `skills.json` on `release`): `name`, `description`, `license`, `author`, `source`, `homepage`. Only `name` + `description` are required.
- **Directly in `data/skills.json`** (no frontmatter equivalent, preserved across releases): `icon`, `docUrl`, `websiteMetadata`, `tags`, and per-version `releaseNotes`, `requiredCredentials`.
- **Never by hand** (CLI-owned): `currentVersion`, `contentHash`, `versions[].{version,gitRef,publishedAt,contentHash}`.

## Skill dev lifecycle

```bash
# 1. edit (or create) data/skills/<slug>/SKILL.md  — frontmatter is auto-validated by a PostToolUse hook
bun run validate                              # manual frontmatter check
ren-registry release <slug> --bump patch      # patch|minor|major; new version + contentHash. omit <slug> to release all drifted/new
ren-registry build && git add -A              # regenerate mirrors + manifests, stage them
bun run check                                 # the CI guard: validate + frozen-integrity + drift + scratch-build diff
# commit & merge to main → publish.yml backfills gitRefs and POSTs to the registry
```

Commands: `bun run typecheck`, `bun run test`, `bun test <file>` / `bun test -t "<name>"`.