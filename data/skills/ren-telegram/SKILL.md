---
name: ren-telegram
description: >-
  Connect Telegram to Ren - map a Telegram DM or group chat to a project for
  chat-to-project routing, and attach the `telegram` MCP to agents that need to
  message Telegram proactively (send messages, send documents, react). Use when
  the user wants a Ren agent to receive Telegram messages, post to Telegram, or
  both.
metadata:
  icon: 'https://cdn.renai.build/skill-icons/telegram.svg'
  tags:
    - ren
    - communication
---

# Telegram Dev

Telegram is **decoupled from Ren** - one org-level bot, and chats (DMs or groups) are mapped to projects independently of who is talking. It has two surfaces, both gated on that one bot being added.

- **Surface A - Chat to project routing.** A user messages a mapped Telegram chat; Ren routes the message to a project's agent; the reply streams back to the same thread. The agent does not know it is Telegram - the message arrives as a normal session turn. Works in DMs and in groups (including forum topics).
- **Surface B - The `telegram` MCP.** The agent itself tool-calls `telegram_send_message`, `telegram_send_document`, `telegram_react`. The agent initiates the Telegram action. Attached once per agent via the agent version's `mcpIds` list.

Both surfaces share the bot. Without the bot in the chat, neither works.

> Commands and flags: `ren telegrams chats list | set | unset`; `ren telegrams claim-code`; `ren telegrams link-code | me | unlink`; `ren mcps get-by-slug telegram`; `ren agents versions create <agt_>` with `--body '{"mcpIds":[...]}'`. Full tree: `ren docs commands`.

## Setup order - always

1. **Add the bot to the chat first.** Start a DM with the bot, or add it to a group. A chat is invisible to Ren until the bot is a member - `ren telegrams chats list` only returns chats the bot can see.
2. **Map the chat to a project** (Surface A) and/or **attach the `telegram` MCP** to an agent (Surface B). A and B are independent - one, both, or neither.

---

## Surface A - Chat to project routing

Use this when a user should be able to **message a Ren project from a Telegram chat and get a reply in-thread**. The agent is *invoked* by Telegram; it does not call Telegram.

### Two ways to map a chat to a project

**Direct mapping** - when you already know the chat id (from `ren telegrams chats list`):

```
ren telegrams chats set <chat-id> \
  --project-id                 <prj_> \
  --default-project-agent-id   <pra_> \
  --fallback-sender-user-id    <usr_> \
  [--topic-id <forum-topic-id>] \
  [--allowed-senders <telegram-user-id> ...] \
  [--blocked-senders <telegram-user-id> ...]
```

**Claim deep link** - the way to map a chat (especially a DM) whose id you cannot easily get. Mint a link and open it *inside* the target DM or group:

```
ren telegrams claim-code \
  --project-id                 <prj_> \
  --default-project-agent-id   <pra_> \
  --fallback-sender-user-id    <usr_>
# -> returns a t.me deep link; opening it in the target chat claims that chat for the project
```

### The fields

- **`projectId`** - the project that answers in this chat.
- **`defaultProjectAgentId`** - the **`pra_` attachment id**, *not* the agent id. Get it from `ren projects agents list <project-id>` (same gotcha as Slack/email and triggers, see [[ren-systems-architect]]). Must be an agent attached to that project. When no slash command is used, this is the agent that answers.
- **`fallbackSenderUserId`** - a **pod member** user id; who a message is attributed to when the Telegram sender is not a linked Ren user. During onboarding, default this to the onboarding user themselves.
- **`topicId`** *(optional)* - map a single forum topic inside a group rather than the whole chat.
- **`allowedSenders` / `blockedSenders`** *(optional)* - Telegram user id allow/block lists for who may run agents in this chat.

### Linking a Telegram account to a Ren user (sender identity)

Telegram senders are decoupled from Ren identities. To attribute a sender to their real Ren user (instead of the fallback), the user links their account:

```
ren telegrams link-code     # mint a deep link to connect a Telegram account to the caller's Ren user
ren telegrams me            # whether the caller's Ren user has a linked Telegram account
ren telegrams unlink        # disconnect the linked Telegram account
```

An unlinked sender runs as the chat's `fallbackSenderUserId`.

### Runtime invariants

- **The agent does not know it is Telegram.** No Telegram-specific code, no special tools, no environment hints. The message arrives as a normal session turn and the reply is streamed back to the thread.
- **Deterministic chats.** Ren triggers *only* on messages in chats it has been explicitly mapped to. Unmapped chats are invisible - no implicit listener, no polling.

---

## Usage

### Invoking agents with slash commands

Each agent attached to the mapped project is exposed as a slash command, `/<agent_name>`, synced into the chat automatically.

```
/agents                            # list the agents available in this chat
/research summarize the latest on competitor pricing
/help                              # Ren help
/link                              # connect your Telegram account to Ren
```

Without a slash command, the chat's `defaultProjectAgentId` answers.

### Sessions: replies continue, new messages start fresh

- **Reply to one of the bot's messages** to continue that conversation - the reply resumes the bound session with full context.
- **Every new, non-reply message starts a brand-new session** with **no context of previous messages.** There is no rolling chat history; only an explicit reply threads back.

### Files work natively

Documents and photos sent to a mapped chat are downloaded by Ren and passed to the agent as attachments (text is also extracted and added as context). The user does not need to do anything special.

### DMs vs groups - addressing the bot

- **In a DM, every message is auto-addressed.** No need to mention the bot - just type.
- **In a group, you must explicitly address the bot.** A group message reaches Ren only if it is one of: an `@bot` mention, a slash command, or a **reply to one of the bot's messages**. Unaddressed group chatter is ignored.

---

## Surface B - The `telegram` MCP (agent tool-calls)

Use this when the **agent itself** needs to send to Telegram: post a proactive message after a cron/webhook run, send a generated document, or react to a message. Surface A handles *inbound*; Surface B handles *outbound*.

### What it is

The registry MCP with **slug `telegram`**, transport `streamable-http`, `auth: "none"`. Its tools: `telegram_send_message`, `telegram_send_document`, `telegram_react` (live list: `ren mcps get-by-slug telegram`). They appear in a session as soon as the agent version's `mcpIds` list references this MCP - no restart, no rebuild.

### Why `auth: "none"` - do not add a vault credential

The MCP acts on behalf of the Ren-installed Telegram bot. It uses the org's bot token at runtime; **no per-agent secret is required**, and adding a vault credential for it will not make calls succeed - the runtime ignores it. (Same model as the Slack and email facade MCPs.)

### When to attach

Attach the MCP **only to agents that need to message Telegram proactively** - a digest agent that posts a daily summary, an agent that pushes a generated report as a document. For agents that only need to *receive* Telegram messages, Surface A's chat mapping is enough; the MCP is unnecessary and adds tool noise.

### How to attach

MCPs are added via the agent version's `mcpIds` list, which is **full-replace** - a new agent version does not merge with the previous one. Pull the current version's body, splice the new id into the `mcpIds` list, then post it back as a new version.

```
# 1. Resolve the telegram MCP id (registry MCP, no --scope needed)
ren mcps get-by-slug telegram             # -> { "id": "mcp_..." }

# 2. Pull the current agent definition (prompt, model, mcpIds, …)
ren agents get <agt_> > /tmp/agent.json

# 3. Splice the new mcpId into the existing mcpIds list in /tmp/agent.json

# 4. Post a new version with the full body
ren agents versions create <agt_> \
  --body @/tmp/agent.json \
  --release-notes "attach telegram MCP"
```

Tools take a `chatId` (e.g. `-1001234567890`) and, for forum topics, a `messageThreadId`. Tools appear in the **next** session that opens against the agent. To remove the MCP, repeat the cycle with the id dropped from the list.

---

## Scope

- **The bot is org-level.** Keyed to the caller's org regardless of any `--scope user` flag. The project a chat maps to can still live in a user-private pod.
- **Chat mappings** reference one project; that project's scope is independent of the bot's.
- **MCP attachments** are agent-scoped; the MCP itself is a registry artifact (no scope choice), but the agent it attaches to can be `user` or `org`.

General scope rules: `ren docs model`.

## Gotchas

- **`pra_`, not `agt_`.** `defaultProjectAgentId` is the project-agent attachment id from `projects agents list`, not the agent id. The wrong one fails validation.
- **The bot must be in the chat.** `telegrams chats list` only returns chats the bot can see - add the bot to a group, or start a DM, before mapping. Use `claim-code` when you cannot get the chat id directly.
- **In groups you must address the bot.** A plain group message is ignored unless it mentions the bot, is a slash command, or replies to the bot. DMs need no mention.
- **New message = new session.** Only a reply to the bot continues a conversation; a fresh message has no prior context.
- **Do not credential the MCP.** `auth: "none"` is correct. Adding a vault entry will not help and may mask wiring errors.
- **`mcpIds` is full-replace.** A new agent version does not merge - `ren agents get` first and pass the union, or you will silently drop existing MCPs.
