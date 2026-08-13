# Composition

The question is not "do we integrate with X?" but **can X reach anything we have, or can anything we
have reach X?** Within two hops the answer is usually yes.

1. Run that two-hop search before saying "we don't support that". Usually the true statement is
   "there's no direct connector".
2. Propose the cheapest hop that works, and say when it is a bridge — name what would make it direct
   later.

## What wakes Ren

Design against this table or the pipeline silently never fires.

| Channel            | What starts a turn                                                                                | Gotcha                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Slack channel**  | an **@mention of the bot** in an explicitly mapped channel                                        | messages from **other apps and bots are dropped before mention parsing** — an alert bot in the channel can never wake Ren |
| **Slack DM**       | any message from a human                                                                          | bot messages still dropped                                                                   |
| **Telegram group** | @mention, Ren's slash command, or a reply to one of the bot's messages                           | plain group chatter is ignored; a new non-reply message starts a fresh session with no history |
| **Telegram DM**    | any message                                                                                       | same fresh-session rule                                                                      |
| **Email**          | the project address in **To, Cc or Bcc** — all equal                                              | cc'ing the project on a live thread works; this is the best third-party bridge               |
| **GitHub**         | `@bot` in an issue or PR comment; PR `opened` / `ready_for_review` only when auto-run is on for that repo | reviews and pushes do not wake it                                                     |
| **Linear**         | a Ren session created or prompted on a mapped workspace                                           | only those two events; webhooks older than 60s are dropped                                   |
| **Cron**           | the schedule you set                                                                              | it cannot tell whether anything changed — that is the ledger's job                           |

**There is no self-serve webhook ingress.** Do not design around a Ren webhook URL; you cannot create
one.

**Therefore:** a third-party alert cannot enter through a Slack channel. The honest bridges are the
**project email address**, or something we control posting as a real user (a GitHub Action, a
scheduled read).

## Capability fallbacks, cheapest first

> **registry MCP → skill + API key in a vault → custom MCP.**

- **Registry MCP** — server, transport and auth already correct, tools carry descriptions. Skip the
  "work out this API" phase. `ren mcps search --sources user org registry`, catalog in
  `ren docs integrations`.
- **Skill + API key** — no registry MCP fits but the product has an HTTP API. Search for an existing
  one first (`ren skills list --query X`) — this rung is where a connector most often already exists
  under a name the MCP search never sees. Otherwise write it: declare the env var in
  `requiredCredentials`; the platform injects it.
- **Custom MCP** — last. Unmaintained surface you now own. Right mainly when the user wants to bring
  their own MCP server onto the platform.

A skill also encodes **workflow** — how this company writes a changelog, what "done" means for a
triage. No MCP carries that. The ladder ranks ways to reach a tool, not skills against MCPs.

## Composing state

| Surface       | Role in a chain                                                       |
| ------------- | ---------------------------------------------------------------------- |
| Memory store  | durable preferences and decisions; read at start, written at end      |
| Pod database  | cursor and dedup ledger across scheduled runs                         |
| File store    | deliverables that accumulate, and inputs a person dropped in          |
| Artifact      | the answer as a page; the URL is unauthenticated                      |

## Worked chains

1. **Tool with no connector that can email** → point its alerts at the project's email address; Ren
   files the Linear issue. (Not: post into a mapped Slack channel — bot messages are dropped.)
2. **Nothing can push** → cron + read-only MCP + pod-database ledger; post a digest only when
   something changed. Say at proposal time that it stays silent when nothing changed.
3. **Code change** → git repository reference, worktree in the session directory, commit, push, PR
   via `gh`.
4. **Analysis nobody reads in chat** → rows in a pod database, an artifact reading them, and a cron
   that re-syncs on the same cadence as the data; one stable URL. `references/artifacts.md`.
5. **Knowledge that must apply to every run of one outcome** → project instructions, not a longer
   prompt and not a line pasted into each trigger message.
