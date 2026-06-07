# Blueprint — desired-state spec, canvas, reconcile loop

The build chain (SKILL.md) is the *what* and *order*. The blueprint is the same chain made **durable,
visual, and checkable**: you author a desired-state `topology.json`, render it so the user watches their
setup form, then drive the chain until the live setup matches — re-rendering as it changes. The on-disk
spec is the source of truth; re-read it instead of trusting context, so the loop survives context bloat
and weaker models.

Two bundled assets back this, both generated from live Ren state so they never drift:

- `assets/topology.schema.json` — the desired-state schema. Identical to the live `GET /api/topology`
  contract, except `id` is optional: an authored draft is keyed by `slug` until entities are provisioned,
  then their `id` fills in. One shape for draft, live, and render.
- `assets/canvas.html` — a self-contained diagram. It accepts the flat topology JSON directly (the same
  shape) and renders pods, projects, agents, surfaces (MCP / cron / Slack / GitHub), vaults, stores, and
  the wires between them.

## Where it runs, and the working files

**CLI transport only.** The scripts need a shell and `bun`. On the MCP or any no-shell transport, **do not
invoke them** — author and self-validate `topology.json` against `assets/topology.schema.json` by hand,
reconcile by reading live state directly (the same entity reads `diff.ts` would make), and hand the user
the live Ren UI link (SKILL.md hand-off) instead of the canvas.

- **The draft** lives at a stable path you re-read every iteration — default `/tmp/ren-topology.json`. It
  is the source of truth; re-read the file rather than trusting context.
- **The bundled scripts** live beside this skill. Invoke them by their path in the skill directory (the
  folder you loaded this skill from), e.g. `bun run <skill-dir>/scripts/render.ts /tmp/ren-topology.json`.
  The scripts self-locate `assets/` relative to themselves, so they run from any cwd.
- **The canvas** is written to `/tmp/ren-canvas.html` (override with `--out`).

## The loop

1. **Author** the draft (`/tmp/ren-topology.json`) from the interview. Conform to `assets/topology.schema.json`. Set the
   required `meta.org` / `meta.orgId` (from `ren publisher me` / whoami) — the schema rejects a draft
   without them, which bites the by-hand MCP-transport path. Give every
   entity a `slug` (+ `name`); omit `id` — it gets written back once provisioned. Capture decisions in
   `meta.notes` and per-entity `notes`, and turn each "this must be true" into a
   `projects[].requirements[]` entry: `kind` (`agent_attached`, `skill_attached`, `mcp_wired`,
   `credential_present`, `trigger_configured`, `slack_mapped`, `vault_attached`, `file_store_attached`,
   `memory_store_attached`, …), a plain-language `must`, the referenced slug
   (`agent` / `skill` / `mcp` / `vault` / `store` / …), `blocking: true` if the build can't be called done
   without it, and a `verify` CLI command. These requirements are the deterministic checklist.

2. **Render** so the user sees the stack they're about to get: `bun run <skill-dir>/scripts/render.ts /tmp/ren-topology.json`.
   Writes `/tmp/ren-canvas.html` and opens it. In a headless/sandbox transport it still writes the file
   and prints the path — hand that over, or fall back to the live Ren UI link (SKILL.md hand-off).

3. **Fetch live** — `ren topology get --output json` (CLI) or `topology_get` (MCP).

4. **Diff** — `bun run <skill-dir>/scripts/diff.ts /tmp/ren-topology.json` (it shells out to `ren topology get`; or pass
   `--live <file>` / `--live -`). It reports, keyed by `slug`: entities **to build** (in draft, not live),
   **extra** (in live, not draft — drift to reconcile or accept), and **changed** fields (model, attached
   skills/mcps, project agents/stores, …); then each requirement as **pass / fail / blocked / manual**
   (`manual` = run its `verify`). The `--- machine ---` JSON block is the worklist.

5. **Build the gap.** For each to-build / fail / blocking item, run the build chain (SKILL.md +
   `references/operations.md` / `references/wiring.md`) — reuse-before-create as always. As each entity is
   created, **write its `id` back into the draft** next to the slug. Honour `blockedBy`: don't attempt a
   requirement whose blocker is unmet.

6. **Re-render and repeat** from step 2 until `diff` reports clean and every blocking requirement passes.
   The `diff` worklist — not the picture — is the authoritative signal for what's left; the canvas is the
   shared view of the target stack, kept current as you write `id`s back. Show the converged canvas at
   hand-off.

## Notes

- Edit the draft, not the live snapshot. The draft is desired state; live is observed state; the loop
  closes the gap one build step at a time.
- **Seed the draft with what you're reusing** — the private pod and the default vault / file / memory
  stores (the reuse-before-create inventory, SKILL.md). Otherwise `diff` flags them `extra` on every pass.
  `extra` (in live, not draft) is informational — drift to accept or reconcile — **never a build failure**;
  the default "Ren" project legitimately stays out of the draft.
- The diff matches on `slug`, so renaming a `slug` reads as one entity removed + one added. Keep slugs
  stable once an entity is live; change `name`, not `slug`.
- File and memory stores are first-class top-level collections (`fileStores` / `memoryStores`, each a
  separate entity with `id` / `slug` / `name` / `scope`), referenced by slug from
  `projects[].fileStores` / `memoryStores` — the same pattern as `vaults` ↔ `pods[].vaults`. Add the
  store to its top-level collection and reference its slug from the project.
- `diff.ts` structurally confirms the requirement kinds it can (agent/skill/mcp/credential/vault/trigger/
  slack/file_store/memory_store); anything else is reported `manual` with its `verify` for you to run.
- Scope discipline is unchanged: author `scope: "user"` entities for a personal build (SKILL.md).

## Script runtime deps

Both scripts run on **`bun`** and import only `node:path` + Bun built-ins — no install step. They read
`assets/` relative to their own location. `scripts/render.ts` opens the file with the platform opener
(`open` / `xdg-open` / `explorer`) and no-ops gracefully when none is available. `scripts/diff.ts` needs
the **`ren` CLI** on PATH only when fetching live itself; with `--live <file>` / `--live -` it needs
nothing beyond `bun`. Neither runs in a no-shell / MCP-only transport — there, self-validate against the
bundled schema and reconcile by reading `topology_get` directly.
