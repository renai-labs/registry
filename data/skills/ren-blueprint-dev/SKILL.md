---
name: ren-blueprint-dev
description: >-
  Package, publish, and install Ren blueprints — the shareable snapshot of a
  resolved Spec. Use when a built setup should be published to the registry,
  installed into another pod, versioned, or deprecated; covers the resolution
  gate, cascade-publish consequences, public-view stripping, and install
  link-vs-fork semantics. Authoring the Spec itself is [[ren-systems-architect]].
metadata:
  tags:
    - ren
---

# Blueprint Dev

A **blueprint** is a Ren row that holds a `Spec` — the slug-keyed snapshot of a setup (agents, skills, MCPs, projects, triggers, environment) plus a `replays` list. It stores **references and version pins, not resource bodies**, and is materialized into real rows only at **install**. This skill is the packaging craft: turning a resolved Spec into a published, installable blueprint, and installing one into a pod. Authoring the Spec — interview, research, build loop, pinning refs — is [[ren-systems-architect]]; come here once the Spec is resolved and the user wants to reuse or share it.

## Commands

CLI (`ren docs commands` for full flags; MCP transport exposes the same as `blueprint_*` tools):

- `ren blueprints push --body @push.json` — upsert from a raw Spec (`{ id?, name?, description?, spec }`). This is [[ren-systems-architect]]'s authoring surface; you'll mostly `get`/`publish`/`install` an already-pushed draft.
- `ren blueprints get <blp-id>` / `ren blueprints list` — inspect drafts and published rows.
- `ren blueprints publish <blp-id>` — publish to the registry (gated + cascading, below).
- `ren blueprints install --body '{ "source": "<blp-id|slug>", "podId": "<pod-id>" }'` — materialize into a pod.
- `ren blueprints deprecate <blp-id> --body '{ "message": "..." }'` / `ren blueprints undeprecate <blp-id>`.
- `ren registry blueprints get <slug>` — the ownerless public view (stripped Spec) — preview a shared blueprint before installing.

`create`/`update` (id-Selection editor path) and `archive` are UI-owned and not on the agent surface — use `push` to author.

## Publish

`publish` is transactional and **idempotent** (re-publishing returns the existing published row).

- **Gates on full resolution.** A Spec with any planned (ref-less) entry is rejected, and the error enumerates the unresolved slugs. Finish the build loop first — every entry must carry a `ref`. Two reasons: cascade-publish needs live entities, and unresolved `def`s hold private interview content that must never reach the registry.
- **Cascade-publishes the entire dependency graph.** Publishing the blueprint publishes every referenced agent, skill, and MCP, plus the row's replays. **Confirm with the user first** — this makes all of that publicly installable, not just the blueprint wrapper. There's no partial publish.

## What the public sees

Owner-scoped reads (`ren blueprints get`) return the full Spec. The **public** registry view (`ren registry blueprints get <slug>`) runs `Spec.toPublic`, which strips everything private:

- **Dropped:** `meta.notes`, the whole `brief`, every entry's `def` body, all `requirements`, all `notes`.
- **Kept:** each entry reduced to `{ slug, ref, name }`; project `channels[]` (kind + purpose describe what the blueprint wires); triggers minus their requirements/notes.

So the interview, prompts (`promptIntent`), and requirement text never leave the org. Put the shareable pitch in `meta.name` / `meta.description` — that's the public-facing copy.

## Version pinning

A Spec pins the version captured when each entry was built/pushed (`latestVersionId` at that moment). Installs **do not track "latest"** — they materialize exactly the pinned versions. To ship an updated blueprint, advance the entities, re-push so the Spec re-pins, then re-publish.

## Install

`install` materializes a Spec into a target pod (`podId`). Per skill / MCP / agent **ref** it independently plans **link vs. fork**:

- **link** (reuse the row id) when the source is published (`publisherId`) or referenceable from the installer's scope.
- **fork** (deep-copy into the installer's org) otherwise. Agent forks **remap** their skill/MCP references to the freshly-installed ids.

Then, in one transaction: insert staged forks, create + attach the environment, create projects. Walk the user through the resulting **`InstallReport`**:

- `projects` / `agents` / `skills` / `mcps` — ids created (or linked).
- `requirements[]` — the setup checklist: authored `requirements` ∪ derived credential needs (installed skills'/MCPs' `requiredCredentials`) ∪ one item per project `channels[]` binding with no live mapping. Non-fatal; the user must satisfy these for the setup to actually work.
- `skipped[]` — missing/archived sources and any unresolved entries, with a reason. Surface these; they're silently degraded, not errors.

Behaviors to tell the user about:

- **Projects are always created fresh** (new ids) — install never reuses an existing project.
- **Cron triggers install disabled and Temporal-unsynced.** They won't fire until the user deliberately enables one (a later `ren triggers update` re-syncs it). Never assume an installed blueprint's crons are live.
- **Every installed project gets the `ren` meta-agent injected** — install hard-fails if no published `ren` agent exists in the registry.
- **Environment is created in the installer's org and attached to the pod.** If the pod already has an environment, install **warns and skips** (appended to `skipped[]`) rather than overwriting.
- **Replays are published but not installed** — a blueprint's replays cascade-publish but `install` has no replay step. Don't promise them in the installed pod.

Install authorization: the `source` resolves by `blp_` id or slug, allowed if the blueprint is published or referenceable from the installer's scope.

## Registry hygiene

- Give a blueprint a clear public `name` and `description` — they're the storefront and the only private-free copy.
- **Deprecate with a `message`** pointing at the successor rather than archiving — installs may already link it.
- Don't publish a blueprint whose dependency graph the user isn't ready to make public; the cascade is all-or-nothing.
