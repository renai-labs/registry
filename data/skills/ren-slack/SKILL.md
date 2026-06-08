---
name: ren-slack
description: >-
  Connect Slack to Ren - install the workspace for channel-to-project routing,
  and attach the `slack` MCP to agents that need to call Slack proactively
  (post, reply, read history, look up users and channels, react). Use when the
  user wants a Ren agent to receive Slack messages, post to Slack, or both.
metadata:
  icon: 'https://cdn.renai.build/skill-icons/slack.svg'
  tags:
    - ren
    - communication
---

# Slack Dev

Slack has two independent surfaces, both gated on one org-level install.

- **Surface A - Channel to project routing.** A user posts in a Slack channel; Ren routes the message to a project's agent; the reply streams back to the thread. The agent does not know it is Slack - the message arrives as a normal session turn. Triggered **only** by deterministic, explicitly-mapped channels: no listener, no polling, no fan-in.
- **Surface B - The `slack` MCP.** The agent itself tool-calls `slack_post_new_message`, `slack_read_channel_history`, `slack_lookup_user`, `slack_react`, and the rest. The agent initiates the Slack action. Attached once per agent via the agent version's `mcpIds` list.

Both surfaces share the workspace install. Without it, neither works.

> Commands and flags: `ren slack install | status | uninstall | channels list | set | unset`; `ren mcps get-by-slug slack`; `ren agents versions create <agt_>` with `--body '{"mcpIds":[...]}'`. Full tree: `ren docs commands`.

## Setup order - always

1. **Install the workspace first** (org-level OAuth). Channel mappings and MCP attachments are no-ops until `ren slack status` shows `hasInstallation: true`.
2. Pick the surface(s) the build needs. A and B are independent - one, both, or neither.

## The install loop - no polling (shared)

`ren slack install` returns `{ "url": "..." }` and there is **no poll endpoint** (unlike the vault OAuth flow in [[ren-vaults-credentials-dev]]). Hand the user the URL, let them complete workspace OAuth consent in the browser, then verify with `ren slack status`. Do not loop a session call - re-read `status` once they are done.

---

## Surface A - Channel to project routing

Use this when a user should be able to **message a Ren project from a Slack channel and get a reply in-thread**. The agent is *invoked* by Slack; it does not call Slack.

### The three ids `slack channels set` needs

```
ren slack channels set <channel-id> \
  --project-id                 <prj_> \
  --default-project-agent-id   <pra_> \
  --fallback-sender-user-id    <usr_>
```

All three are validated server-side:

- **`projectId`** - the project that answers in this channel.
- **`defaultProjectAgentId`** - the **`pra_` attachment id**, *not* the agent id. Get it from `ren projects agents list <project-id>` (same gotcha as triggers, see [[ren-systems-architect]]). Must be an agent attached to that project.
- **`fallbackSenderUserId`** - a **pod member** user id; who a message is attributed to when the Slack sender is not a known Ren user. During onboarding, default this to the onboarding user themselves.

### Runtime invariants

- **The agent does not know it is Slack.** No Slack-specific code, no special tools, no environment hints. The message arrives as a normal session turn and the reply is streamed back to the thread.
- **Deterministic channels.** Ren triggers *only* on messages posted in channels it has been explicitly mapped to. Unmapped channels are invisible to Ren - there is no implicit listener, no background poller, no message queue the agent can subscribe to.

---

## Surface B - The `slack` MCP (agent tool-calls)

Use this when the **agent itself** needs to do anything Slack-y: post a proactive message, reply in a thread, react, upload a file, read channel history, look up a user or channel, edit or delete a message. Surface A handles *inbound*; Surface B handles *outbound and read*.

### What it is

The registry MCP with **slug `slack`**, transport `streamable-http`, `auth: "none"`. Its tools: `slack_post_new_message`, `slack_reply_in_thread`, `slack_react`, `slack_read_channel_history`, `slack_read_thread`, `slack_list_channels`, `slack_list_users`, `slack_lookup_user`, `slack_edit_message`, `slack_delete_message`, `slack_upload_file`, `slack_get_reactions` (live list: `ren mcps get-by-slug slack`). They appear in a session as soon as the agent version's `mcpIds` list references this MCP - no restart, no rebuild.

### Why `auth: "none"` - do not add a vault credential

The MCP declares `auth: "none"` because it acts on behalf of the Ren-installed Slack bot (Surface A's install). It uses the org's bot token at runtime; **no per-agent secret is required**, and adding a vault credential for it will not make calls succeed - the runtime ignores it.

### When to attach

Attach the MCP **only to agents that need to call Slack proactively** - a digest agent that posts a daily summary, a triage agent that reads channel history, a reaction bot. For agents that only need to *receive* Slack messages, Surface A's channel mapping is enough; the MCP is unnecessary and adds tool noise.

### How to attach

MCPs are added via the agent version's `mcpIds` list, which is **full-replace** - a new agent version does not merge with the previous one. Pull the current version's body, splice the new id into the `mcpIds` list, then post it back as a new version.

```
# 1. Resolve the slack MCP id (registry MCP, no --scope needed)
ren mcps get-by-slug slack                # -> { "id": "mcp_..." }

# 2. Pull the current agent definition (prompt, model, mcpIds, …)
ren agents get <agt_> > /tmp/agent.json

# 3. Splice the new mcpId into the existing mcpIds list in /tmp/agent.json

# 4. Post a new version with the full body
ren agents versions create <agt_> \
  --body @/tmp/agent.json \
  --release-notes "attach slack MCP"
```

Tools appear in the **next** session that opens against the agent. To remove the MCP, repeat the cycle with the id dropped from the list.

---

## Scope

- **Install is org-level.** Keyed to the caller's org regardless of any `--scope user` flag. The project a channel maps to can still live in a user-private pod.
- **Channel mappings** reference one project; that project's scope is independent of the install's.
- **MCP attachments** are agent-scoped; the MCP itself is a registry artifact (no scope choice), but the agent it attaches to can be `user` or `org`.

General scope rules: `ren docs model`.

## Gotchas

- **`pra_`, not `agt_`.** `defaultProjectAgentId` is the project-agent attachment id from `projects agents list`, not the agent id. The wrong one fails validation.
- **`status` is the source of truth.** After the user finishes the browser flow, re-read `slack status` (`hasInstallation: true`) before mapping or attaching - there is nothing to poll.
- **The bot must be in the channel.** `slack channels list` only returns channels the Ren bot can see - a private channel will not appear until the user invites the bot to it.
- **Do not credential the MCP.** `auth: "none"` is correct. Adding a vault entry will not help and may mask wiring errors.
- **`mcpIds` is full-replace.** A new agent version does not merge - `ren agents get` first and pass the union, or you will silently drop existing MCPs.
