# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure (brief)

Registry monorepo for Ren skills, built with **Bun** (`bun@1.3.11`).

- `data/` — **source of truth.** Skills live at `data/skills/<slug>/SKILL.md` (+ assets); `data/skills.json` is the registry snapshot; `data/{agents,mcp_servers,tags}.json` are flat registries. `data/composio_mcps.json` is the Composio toolkit catalog — `ren-registry composio-sync` provisions a managed auth config per toolkit (via the Composio API) and publishes one `mcp_provider` MCP row each; the deployment-specific auth-config id is resolved at run time, never committed.
- `skills/`, `plugins/ren/skills/` — **symlinked mirrors** pointing to `data/skills/`. `plugins/.../plugin.json`, `marketplace.json`, `skills.sh.json` — **generated manifests.**
- `cli/` — the `ren-registry` CLI (commander; logic in `cli/src/lib/`). `schemas/` — shared Zod schemas (`@renai-labs/registry-schemas`).

## Dos & Don'ts

- **DO** edit skills only under `data/skills/<slug>/`. **DON'T** hand-edit `skills/`, `plugins/ren/skills/`, or any generated manifest — `ren-registry build` recreates the symlinks and manifests; `check` fails if they're missing or point to the wrong target.
- **DON'T** hand-edit `data/skills.json` except `websiteMetadata` — everything else is generated from SKILL.md frontmatter plus CLI-owned version bookkeeping (`release`/`publish`). **DON'T** put `version:` in SKILL.md frontmatter (frontmatter is `.strict()`); bump versions via `ren-registry release`.
- **DON'T** mutate or delete a frozen version (one whose `gitRef !== null`) — it's published and immutable; `check` rejects PRs that do.
- **DO** run `ren-registry build && git add -A` after a release so generated files stay in sync.
- **DO** add a new skill's slug to a `skills.sh.json` grouping only if it should ship in the bundled plugin (build prunes dead bundle entries but never auto-adds).

## Where each field is edited

SKILL.md frontmatter follows the [agentskills.io spec](https://agentskills.io/specification); `data/skills.json` is generated from it on `release` — only `websiteMetadata` is hand-edited.

- **In SKILL.md frontmatter**: `name`, `description` (required), plus optional `license`, `compatibility` (≤500 chars), `allowed-tools`, and `metadata` (open map). Ren extras live under `metadata`: `author`, `source`, `homepage`, `icon`, `docUrl`, `tags`, `requiredCredentials`. `name` must match the parent directory.
- **Generated into `data/skills.json`** (don't touch): `slug`, `name`, `description`, `license`, `metadata` are derived from frontmatter; `compatibility`/`allowed-tools` stay in SKILL.md (the registry API doesn't consume them).
- **Hand-curated in `data/skills.json`**: `websiteMetadata` — not in SKILL.md; edit it directly on the entry and `release` preserves it across versions.
- **CLI-owned bookkeeping** in `data/skills.json`: `currentVersion`, `contentHash`, `versions[].{version,gitRef,publishedAt,contentHash,releaseNotes}`.

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