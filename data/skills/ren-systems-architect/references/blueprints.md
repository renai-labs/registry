# Blueprints

Demand-driven: a blueprint happens when the user says share, reuse, or hand this to someone — never
because a build had several parts.

A blueprint row holds a **Spec**: a slug-keyed snapshot of a setup, storing **references and version
pins, not bodies**. It becomes real rows only at install.

## Contents

- [The Spec](#the-spec)
- [Working it](#working-it)
- [Publish](#publish)
- [Install](#install)
- [Registry hygiene](#registry-hygiene)

## The Spec

`schemaVersion: 2` with `meta`, optional `brief`, `instructions` (appended to the target pod) and
`initialPrompt`, then `agents[]`, `skills[]`, `mcps[]`, `projects[]`, `triggers[]`, optional
`environment`.

Every entity is an entry keyed by a stable kebab-case `slug`, and entries reference each other **only
by slug**: an agent names its `skills`/`mcps`, a project names its `agents` (`{ slug, mode }`) plus
its own `skills`/`mcps`, a trigger names its `project`.

- **Planned** = has a `def`, no `ref`.
- **Built** = has a `ref` (`{ id, versionId? }`) pinning a live row. Keep the `def` as provenance;
  pinning never rewrites a slug reference.
- **Resolved** = every entry has a `ref`. Publish requires it.

```json
{
  "schemaVersion": 2,
  "meta": { "name": "Bug triage", "description": "Routes inbound bug reports to a triage agent" },
  "skills": [
    { "slug": "linear-triage", "ref": { "id": "skl_1", "versionId": "skv_1" }, "def": { "name": "Linear triage", "registrySlug": "linear-triage" } },
    { "slug": "repro-writer", "def": { "name": "Repro writer", "purpose": "turn a raw report into numbered repro steps" } }
  ],
  "mcps": [],
  "agents": [
    { "slug": "triage", "def": { "name": "Triage", "model": "sonnet-5", "promptIntent": "classify a bug report and file a Linear issue", "skills": ["linear-triage", "repro-writer"], "mcps": [] } }
  ],
  "projects": [
    { "slug": "triage-proj", "def": { "name": "Bug triage", "agents": [{ "slug": "triage", "mode": "all" }] }, "channels": [{ "slug": "bugs-in", "kind": "slack", "purpose": "bug-report intake" }] }
  ],
  "triggers": [
    { "slug": "daily-digest", "project": "triage-proj", "schedule": "0 9 * * *", "timezone": "Europe/London", "inputMessage": "post yesterday's triaged issues" }
  ]
}
```

`linear-triage` is reused and pinned; everything else is still planned, and builds in that dependency
order.

The optional `brief` records why the setup exists — `goal`, `scope`, `actors[]`,
`successCriteria[]`, `constraints[]`, `openQuestions[]`. Fill what you already know from the
conversation; it is private, and it is not a form to make the user complete.

Entry `def` shapes:

| Entry         | `def`                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| `skill`       | `{ name, purpose, registrySlug? }`                                                          |
| `mcp`         | `{ name, registrySlug? \| remoteUrl?, auth? }` — `auth` ∈ `oauth\|basic\|api_key\|none\|mcp_provider` |
| `agent`       | `{ name, model?, promptIntent?, skills: slug[], mcps: slug[] }` — the prompt lives on the agent version, never inlined |
| `project`     | `{ name, description?, agents?, skills?, mcps?, gitRepos?, buildOrder? }` plus `channels[]` |
| `trigger`     | `{ project, agent?, schedule, timezone?, until?, inputMessage, enabled? }`                  |
| `environment` | `{ networking, packages }` — one per Spec, attached to the pod at install                   |

- `project.channels[]` — `{ slug, kind, purpose, agent? }`, `kind` ∈ `slack|linear|github|telegram|email`.
  Declares what channel, for what, on which agent — never concrete workspace/channel/repo ids, which
  are org-foreign and resolved at install.
- Per-entry `requirements[]` — `{ id, kind, must, verify? }`, `kind` ∈
  `credential_present|capability|other`, for non-derivable needs ("operator has prod DB read
  access"). Derivable credential needs and channel bindings are computed at install; don't author
  those.

`meta.notes`, the whole `brief`, and every entry's `def`, `requirements` and `notes` are **private** —
stripped from the public view, which keeps `{ slug, ref, name }` plus project channels. The shareable
pitch goes in `meta.name` / `meta.description`.

This is the one place a strict document survives; everywhere else the plan is plain markdown you keep
to yourself. Even here, don't make the user co-author JSON.

## Working it

```bash
ren blueprints validate --body @spec.json    # structure only: local, no auth, no row
ren blueprints push --body @push.json        # { id?, name, description?, spec } — keep the returned id
ren blueprints get <blp_…> | ren blueprints list
ren blueprints publish <blp_…>
ren blueprints install --body '{"source":"<blp_…|slug>","podId":"<pod_…>"}'
ren blueprints deprecate <blp_…> --body '{"message":"use <successor>"}' | ren blueprints undeprecate <blp_…>
ren registry blueprints get <slug>           # the stripped public view
```

Push is the authoritative gate: it re-validates server-side (a 400 carries exact Zod paths) and runs
the reference check on every pinned `ref`, so only pin ids your scope can see. Build in dependency
order — environment → skills → MCPs → agents → projects → triggers, with `buildOrder` breaking ties
between independent projects — pinning each `ref` and re-pushing as you go. Re-read the file from
disk each iteration. `create`/`update`/`archive` are UI-owned; use `push`.

## Publish

Transactional and idempotent, with two things to say first:

- **Gates on full resolution.** Any planned entry is rejected and the error names the unresolved
  slugs.
- **Cascade-publishes the whole dependency graph** — every referenced agent, skill and MCP, plus the
  row's replays, become publicly installable. No partial publish, no undo. Confirm before running.

Installs materialise the **pinned** versions and never track latest. To ship an update: advance the
entities, re-push so the Spec re-pins, re-publish.

## Install

Atomic, with **no preview to offer**. Per skill / MCP / agent it plans **link** (source is published
or referenceable from the installer's scope) or **fork** (deep copy into the installer's org, with an
agent's dependencies remapped to the fresh ids).

Walk the user through the report, and be honest about what is quietly partial:

- **`requirements[]`** — authored requirements ∪ installed skills'/MCPs' credential needs ∪ one item
  per declared channel with no live mapping. Non-fatal; nothing works until they are satisfied.
- **`skipped[]`** — missing or archived sources are skipped, not fatal. A successful install can be a
  half install; read this before reporting success.
- **Cron triggers arrive disabled**, with a real paused schedule. Never assume they are running. A
  cron whose agent didn't materialise lands in `skipped[]`.
- **Projects are always created fresh**; install never reuses one.
- **Pod and project instructions are appended, never overwritten** — repeated installs accumulate
  prose.
- **The environment is skipped with a warning** if the pod already has one.
- Every installed project gets the `ren` meta agent injected; install hard-fails if no published
  `ren` agent exists.
- Replays cascade-publish but are **not** installed.

## Registry hygiene

Give it a public name and description that stand alone — they are the storefront and the only
private-free copy. Deprecate with a message pointing at the successor rather than archiving; installs
may already link it.
