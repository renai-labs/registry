---
name: ren-systems-architect
description: >-
  Explains the Ren data model, scope tiers, and the build chain, and decides what
  pods, projects, agents, skills, MCPs, stores, and triggers to set up and in what
  order. Load before any Ren build to choose the right primitives, run the
  reuse-before-create path, and wire everything together; and whenever a user asks
  how to structure or arrange their Ren setup. Designs multi-entity or share-worthy
  setups spec-driven — interview into a brief, research, author a Spec, push a draft
  blueprint, build the graph leaf-up pinning refs, publish. Owns the Ren CLI /
  registry mutations that compose a build — reuse, create, version, attach, scope,
  wire; the standalone dev skills hold only authoring craft.
metadata:
  tags:
    - ren
---

# Ren Systems Architect

This skill is Ren's mental model and decision engine: the map from a user's recurring work to the Ren primitives that deliver it, the order to build them, and every Ren operation that mutates the setup. The standalone dev skills — [[ren-skill-dev]], [[ren-agent-dev]], [[ren-mcp-dev]], [[ren-vaults-credentials-dev]] — hold only authoring craft (taste); reach for one only when you need its depth. Everything else — reuse, search, create, version, attach, scope, publish, wiring — happens here.

## Load the manual

Before any build, pull the source-of-truth references and keep them handy. **Read them; don't recite them to the user.**

- `ren docs model` / `ren://docs/data-model` — entities, scope tiers, credential resolution, build-chain ordering.
- `ren docs integrations` / `ren://docs/integrations` — the index of what to reach for per task.
- `ren docs commands` — the full command tree, every command and flag (CLI transport; MCP transport exposes the same surface as `mcp__ren__*` tools).

## Default mode: spec-driven

**Threshold rule.** A single-entity tweak — bump a prompt, attach one skill, change a schedule — just runs the operation directly (`references/operations.md`); no ceremony. Anything that spans **more than one entity**, or that the user might reuse or share, is built **spec-driven**: capture it as a `Spec` first, then build from it.

The flow: interview the user into a `brief` → research what already exists (org before registry, then the web) → author a slug-keyed `Spec` where each entry is *planned* (`def`) or *built* (`ref`) → `ren blueprints push` it as a **draft blueprint from the first minute** → build the graph leaf-up, pinning each live id back into the doc and re-pushing → a fully-resolved Spec is a publishable blueprint. The Spec is the durable, resumable plan even when nothing is ever shared. Narrate each step in the user's register (builder vs consumer — [[ren-onboarding]] owns that framing).

Full method, entry shapes, and a worked example: **`references/spec.md`**. The data model, scope, reuse, credentials, and wiring below are what that loop draws on at each step.

## The data model in one breath

A **pod** is a durable sandbox plus a member set; everything attached to it (skills, MCPs, stores, vaults) is available to every project inside. A **project** groups the agents, stores, and triggers for one outcome. An **agent** is a prompt + model + dependencies (skills and MCPs). **Vaults** hold **credentials** (injected as env vars at runtime). **Stores** are durable volumes — file (read-only) or memory (read-write). **Triggers** run a project's primary agent on a cron. Scope tiers are `user` / `org` / `registry`. Full detail: `ren docs model`.

## Scope discipline

Default to **`--scope user`** for a personal build — agents, skills, MCPs, stores, and vaults all default to `org` otherwise, and you need `--scope user` even to *see* the private pod. Promote to `org` only when the user explicitly wants something shared. Key constraint: you can't pull a narrower-scope artifact into a broader-scope publication (a `user` skill backs a `user` or `org` agent, not the reverse). Full rules — inheritance, reference direction, the `search` / `--sources` exception — are in `ren docs model`.

## Reuse before you create

The cheapest, most reliable build reuses what already exists. Three tiers, in order:

1. **Reuse** an existing registry / org / user artifact as-is.
2. **Fork** a close-enough one into your scope and edit it — the baked-in domain knowledge is worth keeping.
3. **Author / register custom** only when neither fits.

Registry skills and MCPs are tested and production-ready — inherit their commands, schemas, and gotchas rather than reasoning from scratch. A custom MCP is unmaintained surface you now own: prefer a registry MCP, and when none fits, fall back to an API-key-backed skill. The index of what to reach for per task is `ren docs integrations`.

This skill carries enough to **search + attach + basic-fork** a registry skill/MCP (see `references/operations.md`). Descend into [[ren-skill-dev]] / [[ren-mcp-dev]] **only to author a custom skill or register a custom remote MCP** — that's the sole reason those skills exist as indirection.

## Reuse-before-create inventory — what's already there

A personal build starts with these already provisioned. Reuse them; don't recreate:

- **Private pod** (`<UserName>'s Pod`) — build here, never create another.
- **Default vault** (`<UserName> Vault`) — attached at priority 0; add credentials here.
- **Default file store** (`<UserName> Files`) — reuse unless this agent's docs shouldn't mix with the user's general files.
- **Default memory store** (`<UserName> Memory`) — reuse; this is the user's persistent private memory.
- **Default "Ren" project** — **never touch.** Always create a fresh project for what you build.

Audit what exists before building (`ren docs commands` has the list/get invocations): pods, vaults, file/memory stores, and the projects already in the private pod.

## The build chain

Dependencies build **leaf-up**. Each step routes to where its mechanics live — commands in `references/operations.md` and `references/wiring.md`; authoring craft in the linked dev skills. In spec-driven mode this same order is what `Spec.buildPlan` yields (environment → skills → mcps → agents → projects → triggers); build one entry, pin its `ref`, re-push, repeat.

1. **Skills** — reuse / fork here (`references/operations.md`); author a custom skill → [[ren-skill-dev]].
2. **MCPs** — reuse here (`references/operations.md`); register a custom remote MCP → [[ren-mcp-dev]].
3. **Credentials** (orthogonal) — wire only if a skill/MCP needs auth; connect/refresh choreography → [[ren-vaults-credentials-dev]]. Design below.
4. **Agent** — prompt + model + the skills/MCPs above. Writing / model / dependency judgment → [[ren-agent-dev]]; create & version commands → `references/operations.md`.
5. **Stores** — default: attach the existing default file/memory stores to the fresh project; create new only for isolation → `references/wiring.md`.
6. **Project** — always a fresh project in the private pod; attach the agent as `primary` and the stores from step 5 → `references/wiring.md`.
7. **Trigger** (optional) — cron schedule → `references/wiring.md`.
8. **Sandbox readiness + session** — get the sandbox `ready`, then hand off → `references/wiring.md`.


## Credentials — the design

A vault is a credential safe; credentials live inside it, encrypted at rest, and are injected as env vars at runtime — **secrets never live in prompts.** Vaults are `user`- or `org`-scoped (no registry tier); a credential inherits its vault's scope. Resolution walks the pod's attached vaults by priority (lower number wins), first-match-by-name, mapping a credential `name` to the env var a skill/MCP reads. The OAuth connect/poll flow, API-key shape, and lazy refresh are all in [[ren-vaults-credentials-dev]].

## How to arrange pods & projects

One **private pod per user** for personal work. **Team pods are shaped around shared work, not the org chart** — a sales team, an emergency warroom, a per-customer pod, a prod-vs-staging credential split. Ask "who else needs to see this?" before creating one. Use **separate projects per outcome** and **separate pods per member set** (members are pod-scoped). Don't reuse a project for a brand-new outcome — a fresh project keeps the agent isolated and trivial to throw away. Mechanics: `references/wiring.md`.

## Share it

When a spec-driven build is fully resolved (every entry pinned) and the user wants to reuse or hand it to others, it's a shareable **blueprint** — publish it to the registry or install it into another pod. That packaging craft — the resolution gate, cascade-publish consequences, public-view stripping, and install link-vs-fork semantics — is [[ren-blueprint-dev]]. An internal-only stack needs none of this; leave the draft blueprint unpublished and you're done.

## References

- `references/spec.md` — the spec-driven method: interview → brief, research, author the `Spec`, push a draft blueprint, build the graph leaf-up pinning refs, publish.
- `references/operations.md` — the Ren CLI / registry operations for the composable artifacts (skills, MCPs, agents) plus credential ops: search, fork, create, version, attach, OAuth.
- `references/wiring.md` — the plumbing primitives: pods & sandbox readiness, projects & sessions, stores, triggers.
