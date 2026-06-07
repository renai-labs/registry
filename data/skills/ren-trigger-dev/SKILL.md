---
name: ren-trigger-dev
description: >-
  Make a project run on its own via a cron trigger - schedule the project's
  primary agent on a fixed cadence with a fixed input message. Use when the user
  wants an agent to fire on a schedule.
---

# Trigger Dev

A trigger runs a project's **primary** agent without anyone manually starting a session. It's pinned to a `projectAgent` (the agent's attachment to a project, id prefix `pra_`), so the project must already have a primary agent attached (see [[ren-project-dev]]). Today only **cron** triggers are in scope (id prefix `ctrg_`) — fire on a schedule with a fixed input message.

> Commands and flags (`triggers create / update`, required fields): `ren docs commands`. Scope inheritance from the project: `ren docs model`. This skill is the gotchas.

## Runtime behavior

A trigger opens a fresh session against the project's primary agent on each fire, with `inputMessage` as the first user turn. The sandbox must be `ready` when it fires — Ren wakes a paused sandbox on demand, but a `failed` sandbox blocks the fire. Toggling `isEnabled` propagates on the next manifest refresh; you don't need to recreate the trigger.

## Gotchas

- The `projectAgentId` is the **attachment id** (`pra_…`), not the agent id (`agt_…`). Get it from `ren projects agents list <project-id>`.
- `--schedule` is a 5-field cron expression; always set `--timezone` or it runs in the org default (UTC).
- `triggers update` needs `--project-id` too — it's the auth-scope key, not a change field.
- Prefer enabling a trigger only after a manual dry-run of the same input has been verified end-to-end from a real session — once the cron is live, any unnoticed failure mode keeps recurring on every fire.

## Next steps

- **Verify a fire** via `ren sessions list --project-id prj_…` after the first scheduled run — the trigger spawns a real session you can inspect.
- **Make the agent better at the recurring task** based on what the dry-run surfaced — update its prompt or skills ([[ren-agent-dev]]) before enabling.
