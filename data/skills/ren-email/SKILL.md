---
name: ren-email
description: >-
  Use when configuring Ren's native project email channel: enabling, listing, or
  disabling a project mailbox; or attaching the `email` MCP so
  cron, webhook, or other proactive agent runs can call `email_send`. Do not use
  for Gmail scanning, labelling, or mailbox automation; use Google Workspace for
  that.
metadata:
  icon: 'https://cdn.renai.build/skill-icons/email.svg'
  tags:
    - ren
    - email
    - communication
---

# Email Dev

Ren email is a native project-level channel. It gives a project a deterministic mailbox:

```
<org_slug>.<project_slug>@agents.renai.build
```

Users can send, forward, or cc emails to that address. Ren creates or resumes the project session, runs the agent, and replies back to the same email thread. The agent does not need to know email exists for normal inbound email workflows.

> Commands and flags: `ren emails list`; `ren emails set <project-id>` with optional `--default-project-agent-id` and `--fallback-sender-user-id`; `ren emails unset <project-id>`; `ren mcps get-by-slug email`; `ren agents versions create <agt_>` with `--body '{"mcpIds":[...]}'`. Full tree: `ren docs commands`.

## Setup order

1. Find or create the project that should own the mailbox.
2. Pick the project agent attachment id (`pra_`) that should answer email.
3. Enable the mailbox with `ren emails set <project-id>`.
4. Share the returned mailbox address with the user.
5. Attach the `email` MCP only if the agent must proactively send email.

## Native inbound email

Use this when the user should be able to email a Ren project and get a reply in the same thread.

```bash
ren emails set <project-id> \
  --default-project-agent-id <pra_> \
  --fallback-sender-user-id <usr_>
```

The body fields:

- **`projectId`** - the project that owns the mailbox.
- **`defaultProjectAgentId`** - the **`pra_` attachment id**, not the agent id. Get it from `ren projects agents list <project-id>`. It must be an agent attached to that project.
- **`fallbackSenderUserId`** - a pod member user id; who email is attributed to when the sender is not a known Ren user. During onboarding, default this to the onboarding user.

Check existing mailboxes with:

```bash
ren emails list
```

Disable a project's mailbox with:

```bash
ren emails unset <project-id>
```

## Runtime invariants

- **The agent does not know it is email.** No email-specific prompt branch, no Email MCP, and no mailbox polling. The email arrives as a normal session turn.
- **Replies are platform-managed.** When a user sends or forwards email to the project mailbox, Ren deterministically replies to that same email thread.
- **Mailboxes are project-level.** Use `ren emails set` and `ren emails unset` per `projectId`; do not configure email at the agent, pod, or org level.
- **No Gmail scanning.** For scanning Gmail, labelling messages, or taking actions inside a user's Google mailbox, use the Google Workspace skill instead. This skill is for Ren's native project mailbox.

## Proactive outbound email

Use this only when the **agent itself** needs to send an email after a non-email event: cron trigger, webhook, background workflow, or another session that should notify a user by email.

Attach the registry MCP with slug `email` to that agent, with tool `email_send`

```bash
# 1. Resolve the Email MCP id
ren mcps get-by-slug email                 # -> { "id": "mcp_..." }

# 2. Pull the current agent definition
ren agents get <agt_> > /tmp/agent.json

# 3. Add the email mcp id to the existing mcpIds list in /tmp/agent.json

# 4. Post a new version with the full body
ren agents versions create <agt_> \
  --body @/tmp/agent.json \
  --release-notes "attach email MCP for outbound email"
```

`mcpIds` is full-replace. Always preserve existing MCP ids when creating the new version.

Typical proactive flow: a cron trigger creates a session, the agent completes the scheduled task, then calls `email_send` to notify the user.

## Gotchas

- **Inbound does not need an MCP.** If the user only wants to forward emails or email the project mailbox, do not attach the `email` MCP.
- **Outbound does need the `email` MCP.** A cron or webhook-triggered agent cannot send a proactive email unless its agent version includes the `email` MCP.
- **`pra_`, not `agt_`.** `defaultProjectAgentId` is the project-agent attachment id from `projects agents list`.
- **Use Google Workspace for Gmail operations.** Native Ren email is not a general Gmail automation surface.
