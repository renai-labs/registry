---
name: trigger-dev
description: Make a project run on its own via a cron trigger - schedule the project's primary agent on a fixed cadence with a fixed input message. Use when the user wants an agent to fire on a schedule.
---

# Trigger Dev

A trigger runs a project's **primary** agent without anyone manually starting a session. It's pinned to a `projectAgent` (the agent's attachment to a project, id prefix `pra_`), so the project must already have a primary agent attached (see [project-dev]).

Today only **cron** triggers are in scope (trigger id prefix `ctrg_`) - fire on a Temporal schedule with a fixed input message.

## Build via CLI

```
ren triggers create \
  --project-id        prj_… \
  --project-agent-id  pra_… \
  --schedule          "0 */2 * * *" \
  --input-message     "Triage any new PRs and post a summary." \
  --timezone          "America/New_York" \
  --is-enabled        false \
  --output json
```

`--project-id`, `--project-agent-id`, `--schedule`, and `--input-message` are required. Update needs `--project-id` too:

```
ren triggers update <trigger-id> --project-id prj_… --is-enabled true
```

## Build via MCP

`{ path, query, body }` envelope:

```
mcp__ren__trigger_create { "body": { "projectId":"prj_…", "projectAgentId":"pra_…",
                                     "schedule":"0 */2 * * *", "inputMessage":"…",
                                     "timezone":"America/New_York", "isEnabled": false } }
mcp__ren__trigger_update { "path": { "triggerId":"ctrg_…" },
                           "body": { "projectId":"prj_…", "isEnabled": true } }
```

## Gotchas

- The `projectAgentId` is the **attachment id** (`pra_…`), not the agent id (`agt_…`). Get it from `ren projects agents list <project-id>`.
- `--schedule` is a 5-field cron expression; always set `--timezone` or it runs in the org default (UTC).
- Prefer enabling a trigger only after a manual dry-run of the same input has been verified end-to-end from a real session - once the cron is live, any unnoticed failure mode keeps recurring on every fire.
