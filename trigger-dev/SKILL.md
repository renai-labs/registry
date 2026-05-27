---
name: trigger-dev
description: Make a project run on its own — cron triggers (schedule) and webhook triggers (provider events like GitHub push or Slack mention). Use when the user wants an agent to fire on a cadence or in response to an external event.
---

# Trigger Dev

A trigger runs a project's **primary** agent without anyone typing. It's pinned to a `projectAgent` (the agent's attachment to a project), so the project must already have a primary agent attached (see [project-dev]).

- **Cron** — fires on a Temporal schedule with a fixed input message.
- **Webhook** — fires on a provider event (GitHub push, Slack mention, …); requires a native integration installed first.

## Lifecycle in the manifested sandbox

A trigger doesn't mount anything. When it fires, the platform opens a fresh session against the pod's sandbox and runs the project's primary agent with the configured input — same sandbox, same mounted skills/MCPs/stores the agent already has. So the **sandbox must be ready** when the trigger fires; a paused pod resumes on demand (see [pod-dev]).

Because the run is unattended, treat the first live fire as the risk point: **create the trigger disabled, do one manual run from a session, then enable.**

## Build via CLI — cron

```
ren triggers create \
  --project-id        prj_… \
  --project-agent-id  pag_… \
  --schedule          "0 */2 * * *" \
  --input-message     "Triage any new PRs and post a summary." \
  --timezone          "America/New_York" \
  --is-enabled        false \
  --output json
```

`--project-id`, `--project-agent-id`, `--schedule`, and `--input-message` are required. Flip on after a clean manual run:

```
ren triggers update <trigger-id> --is-enabled true
```

## Build via CLI — webhook

Webhook triggers need a provider that's already installed in the web app (`/app/settings/admin/integrations`), which yields a `providerInstallId`:

```
ren webhook-triggers create \
  --project-id       prj_… \
  --project-agent-id pag_… \
  --provider         github \
  --provider-install-id  ins_… \
  --is-enabled       false \
  --body '{ "filter": { "repo": "org/repo" } }'
```

## Build via MCP

```
mcp__ren__trigger_create { "projectId":"prj_…","projectAgentId":"pag_…","schedule":"0 */2 * * *","inputMessage":"…","isEnabled":false }
mcp__ren__trigger_update { "id":"trg_…","isEnabled":true }
mcp__ren__webhookTrigger_create { "projectId":"prj_…","projectAgentId":"pag_…","provider":"github","providerInstallId":"ins_…","isEnabled":false }
```

## Gotchas

- The `projectAgentId` is the **attachment id**, not the agent id. Get it from `ren projects agents list <project-id>`.
- Cron `--schedule` is a 5-field cron expression; always set `--timezone` or it runs in the org default (UTC).
- A webhook trigger that depends on a native integration the user hasn't installed yet → create it disabled and tell them what to install.
- Don't enable a trigger you haven't dry-run once from a real session.
