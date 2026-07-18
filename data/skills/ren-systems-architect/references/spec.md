# Spec-driven development

The default way to build anything on Ren that spans **more than one entity** — or anything worth sharing. A **Spec** is one JSON document describing a whole setup: the agents, skills, MCPs, projects, triggers, and environment that deliver a business function. You interview the user into a `brief`, research what already exists, author the Spec, push it as a **draft blueprint** from the first minute, then build the graph leaf-up — pinning each live id back into the doc — until every entry is resolved. A resolved Spec is a publishable, installable **blueprint**.

Single-entity tweaks skip all of this — just run the operation (`references/operations.md`). Reach for a Spec when the build has multiple moving parts or the user might want to reuse/share it.

## The document (`Spec`, `schemaVersion: 2`)

Sections: `meta`, `brief`, `agents[]`, `skills[]`, `mcps[]`, `projects[]`, `triggers[]`, `environment?`. Every entity is an **entry** keyed by a stable kebab-case `slug` — the slug is the only way entries reference each other, and it never changes.

- **planned** = the entry has a `def` (what to build), no `ref`.
- **built** = the entry has a `ref` (`{ id, versionId? }`) pinning it to a live row. Keep the `def` as provenance.
- **Cross-references are always by slug** — agent → its `skills`/`mcps`, project → `primaryAgent`/`subAgents`, trigger → `project`. Pinning an id never rewrites a reference.
- A Spec is **resolved** when every entry has a `ref`. Publish requires this.

`meta.notes`, the whole `brief`, and every entry's `def`/`requirements`/`notes` are **private** — stripped from the public registry view. Only `{ slug, ref, name }` (+ project `channels`) survives publish. Put the shareable pitch in `meta.name`/`meta.description`.

## 1. Interview → `brief`

Draw out the recurring work, not a feature list. Fill the `brief`:

- `goal` (required) — the business function this maps onto Ren, in one sentence.
- `scope` — what's in and out.
- `actors[]` — who/what interacts (people, external systems).
- `successCriteria[]` — observable outcomes that mean "this works".
- `constraints[]` — hard limits, nuances, things they've already tried.
- `openQuestions[]` — unknowns the build must burn down.

Use the native question tool for anything ambiguous. Summarise the brief back in 2–3 sentences before authoring.

## 2. Research — reuse before you author

Before writing a single `def`, find what exists. Org artifacts outrank the public registry (server-side precedence):

- `ren skills search --sources user org registry --query "<need>"`
- `ren mcps search --sources user org registry --query "<need>"`
- `ren agents search --sources user org registry --query "<need>"`

For gaps the registry can't fill, **web search** for adaptable third-party skills (SKILL.md you fork + migrate → [[ren-skill-dev]], `references/adapting-skills.md`) and remote MCP servers (register → [[ren-mcp-dev]]). Record findings on the entry `def`: a registry hit becomes `skill.def.registrySlug` / `mcp.def.registrySlug`; a custom server becomes `mcp.def.remoteUrl` + `mcp.def.auth`. `ren docs integrations` is the curated index of native integrations and registry MCPs by category.

## 3. Author + push a draft immediately

Write `spec.json` at the pod workspace root. Check its structure locally before anything hits the network — this parses against the real Spec schema (bundled in the CLI, no auth, no row created), so you catch shape errors fast:

```bash
ren blueprints validate --body @spec.json   # -> { "valid": true } or exact issue paths; exits non-zero on failure
```

Once it's structurally valid, create the draft blueprint **right away** — the row exists from day one and is the durable, resumable home for the build:

```bash
ren blueprints push --body @push.json       # { "name": "...", "spec": <contents of spec.json> }
```

Capture the returned `id` and pass it on **every** subsequent push (`{ "id": "blp_…", "name": …, "spec": … }`) so re-pushes update in place. `validate` checks structure only; `push` is the authoritative gate — it re-validates the whole Spec server-side (a `400` carries the exact Zod paths) and runs `canReference` on every pinned `ref`, so only pin ids your scope can actually see (stay `--scope user` for a personal build).

Re-read `spec.json` from disk each iteration rather than trusting context — the loop then survives context bloat.

### Entry `def` shapes (author only what you're building)

- **skill** — `{ name, purpose, registrySlug? }`. `purpose` drives [[ren-skill-dev]] for a planned custom skill; `registrySlug` marks a reuse.
- **mcp** — `{ name, registrySlug? | remoteUrl?, auth? }` where `auth` ∈ `oauth | basic | api_key | none | mcp_provider`.
- **agent** — `{ name, model?, scope?, promptIntent?, skills: slug[], mcps: slug[] }`. `model` is a Ren model key (`opus-4-8`, `sonnet-5`, `haiku-4-5`); the actual prompt lives on the agent version, never inlined in the Spec — `promptIntent` records what it must accomplish.
- **project** — `{ name, description?, primaryAgent?, subAgents?, permission?, gitRepos?, buildOrder? }`. A project also carries `channels[]` (see below).
- **trigger** — `{ project, agent?, schedule, timezone?, until?, inputMessage, enabled? }`. Always concrete; `ref` is `{ id }` once created.
- **environment** — `def: { networking, packages }` mirroring `environment/schema.ts`. One per Spec, attached to the pod at install.

### Channels & requirements

- `project.channels[]` — declarative `{ slug, kind, purpose, agent? }` where `kind` ∈ `slack | linear | github | telegram | email`. Declares _what channel, for what, on which agent_ — never the concrete workspace/channel/repo ids (those are org-foreign, resolved live at install). Native channel setup itself is [[ren-slack]] / [[ren-github]] / [[ren-email]] / [[ren-telegram]].
- Per-entry `requirements[]` — `{ id, kind, must, verify? }` with `kind` ∈ `credential_present | capability | other`, for non-derivable needs the operator must satisfy ("operator has prod DB read access"). These become the installer's checklist. Derivable credential needs (a skill/MCP's `requiredCredentials`) and channel-config items are computed at install — don't author those.

## 4. Build loop — leaf-up, pin, re-push

Build in dependency order (`Spec.buildPlan`): **environment → skills → mcps → agents → projects → triggers**; `project.def.buildOrder` breaks ties between independent projects. For each entry:

1. Delegate the craft to the right dev skill — [[ren-skill-dev]] / [[ren-mcp-dev]] / [[ren-agent-dev]] / [[ren-vaults-credentials-dev]] — and run the create/version command (`references/operations.md`, `references/wiring.md`).
2. Pin the result: write `ref: { id, versionId }` onto the entry (from the created row).
3. Re-push `spec.json` so the draft advances.

Reuse entries (registry/org hits) are already resolved — pin their `ref` at authoring time. Credentials are orthogonal: wire them when an entry that needs auth is built (connect-now vs wire-later is the operator's call).

## 5. Resolve, then publish

When `spec.json` has no planned entries left, it's a shareable blueprint. Hand off to [[ren-blueprint-dev]] for the publish/install craft — publish gates on full resolution, cascade-publishes the whole dependency graph, and strips the private fields. For an internal-only stack, simply leave the draft unpublished; the build is done.

## Worked example (partially resolved)

```json
{
  "schemaVersion": 2,
  "meta": { "name": "Bug triage bot", "description": "Routes inbound bug reports to a triage agent" },
  "brief": {
    "goal": "Triage inbound bug reports in Slack and file clean Linear issues",
    "successCriteria": ["every #bugs message gets a triaged Linear issue within 5 min"]
  },
  "skills": [
    {
      "slug": "linear-triage",
      "ref": { "id": "skl_123", "versionId": "skv_123" },
      "def": { "name": "Linear triage", "purpose": "classify + file issues", "registrySlug": "linear-triage" }
    },
    {
      "slug": "repro-writer",
      "def": { "name": "Repro writer", "purpose": "turn a raw report into numbered repro steps" }
    }
  ],
  "mcps": [],
  "agents": [
    {
      "slug": "triage",
      "def": {
        "name": "Triage",
        "model": "sonnet-5",
        "scope": "user",
        "promptIntent": "read a bug report, classify severity, file a Linear issue",
        "skills": ["linear-triage", "repro-writer"],
        "mcps": []
      }
    }
  ],
  "projects": [
    {
      "slug": "triage-proj",
      "def": { "name": "Bug triage", "primaryAgent": "triage" },
      "channels": [{ "slug": "bugs-in", "kind": "slack", "purpose": "bug-report intake" }]
    }
  ],
  "triggers": [
    {
      "slug": "daily-digest",
      "project": "triage-proj",
      "schedule": "0 9 * * *",
      "inputMessage": "post yesterday's triaged issues as a digest"
    }
  ]
}
```

Here `linear-triage` is reused (pinned), `repro-writer` is still planned, and the agent/project/trigger are planned. `Spec.buildPlan` will build `repro-writer` → `triage` → `triage-proj` → `daily-digest`; each step pins its `ref` and re-pushes. Once `repro-writer` and the rest resolve, the blueprint is publishable.
