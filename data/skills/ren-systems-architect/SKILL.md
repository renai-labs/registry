---
name: ren-systems-architect
description: >-
  Turn what a user describes into a Ren setup that runs without them, and manage everything
  already built. Use whenever a user wants something built, automated, scheduled, watched, or
  connected — "make a dashboard of our daily commits", "post a summary every morning", "tell me when
  this repo breaks", "it should read our customer list" — or asks what exists or is connected; wants
  to create, change, debug, publish, install, or remove a Ren resource (pods, projects, project
  instructions, skills, MCPs, stores, pod databases, credentials, channels, triggers, artifacts,
  blueprints); wants to restrict, gate, or approve what a project's tools may do — "make it
  read-only", "ask me before it posts", "it shouldn't be able to delete anything"; describes
  recurring manual work or a missing integration; or is getting started with Ren.
metadata:
  tags:
    - ren
---

# Ren systems architect

Turn what a person describes — _"I check the deploy channel every morning to see if anything broke"_
— into something that runs without them.

## Read the map when the turn is about the map

`ren topology get` returns the whole visible graph in one call. Run it once when the user asks what
exists ("do we have X / is Y connected / what's running") or before proposing or making a Ren
configuration change. Do not run it for ordinary work the current project can already serve;
`<workspace_context>` and your tool descriptions are enough. Re-read only after changing
configuration. It is viewer-scoped, so say "I don't see", never "we don't have". In a shared pod it
is also the only source of the current user's identity. `references/topology.md`.

## Work shapes

| What they said                                 | What they get                                                | What delivers it                                             |
| ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| "Something should watch X"                     | A message when it matters, silence when it doesn't           | Ingress if the source can push, else cron + a dedup ledger     |
| "This should happen every Monday"              | It happens every Monday, in their timezone                   | Cron trigger on the project, timezone set explicitly           |
| "I keep being the router between two tools"    | The hand-off happens without them in the middle              | One project holding both integrations, woken by the first      |
| "It should know our stuff"                     | Answers that already assume the company's facts              | Instructions at the widest layer where the fact is true        |
| "It keeps forgetting what I told it"           | Next run picks up where this one left off                    | Memory store, read at start and written at the end             |
| "I want to look at this, not read it"          | A page at a URL that refreshes itself                        | Artifact, rebuilt on the same schedule as its data             |
| "My team needs this too"                       | Teammates get it without a hand-off conversation             | Build in the shared pod, or hand over a blueprint              |
| "It dies when I close my laptop"               | It keeps running, and they read the result later             | A pod: durable sandbox, sessions they can reopen               |
| "I keep re-pasting the same API key"           | Connected once, Ren can use it in the pod                    | A credential in the vault the pod resolves                     |
| "Here's our pricing sheet / customer list"     | Ren works from their material, not generic knowledge         | File store attached to the project                             |
| "It needs Linear / HubSpot / our calendar"     | It acts in that tool directly                                | Registry MCP, else a skill with an API key, else a custom MCP  |
| "It should work on our repo / in our channel"  | It reads and writes where the work already happens           | Native integration: GitHub, Slack, Telegram, email, Linear     |
| "Stop telling me about this"                   | It goes quiet without losing what was useful                 | Narrow the condition or slow the cadence, then say what changed |

The middle column is the deliverable. Write it before you build.

## Primitives by kind

| Kind              | Nature                                              | Primitives                                                               |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| **Config**        | declared, versioned, travels                         | skill, MCP, blueprint, project model, instructions                       |
| **Volume**        | a mounted path read and written during a run        | file store, memory store, pod scratch, git repository                    |
| **Durable state** | outlives the session, queryable or addressable      | pod database, artifact, credential (in a vault)                          |
| **Delivery**      | how a run starts and where output lands             | project, channel mapping, cron trigger                                   |

A **pod** is one durable sandbox plus a member set; everything in it shares that machine. A
**project** carries instructions, a default model, capabilities, stores and triggers for one
outcome. Mechanics: `references/operations.md`. Entity rules: `ren docs model`.

## The project is the boundary

- Reuse the project you are in. Create one only for a genuinely distinct scope or outcome, and
  prefer reusing an existing project over adding another.
- Stable rules that must accompany every run go in project instructions; org and pod instructions
  append above them and hold on every turn.
- Evolving facts, decisions, history, and preferences go in an attached memory store; consult that
  memory only when relevant.
- Attach new and user-created skills and MCPs to the project. Make a clearly required, reversible
  attachment immediately and report it; otherwise finish the task and offer at most one concise
  improvement.
- Configure the default model only at project level. Do not invent further model-resolution layers.
- Gate what tools may do with the project's `permission` config: read-only, approval-first, and
  locked-down asks are project permission changes. `references/permissions.md`.

### The four state surfaces — pick by shape of data

| Surface          | Holds                                                       | Reach for it when                                  |
| ---------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| **Memory store** | durable facts about people, teams, preferences; prose       | you learned something worth knowing next session   |
| **File store**   | deliverables and working files; accumulates                 | the run produces something the next run builds on  |
| **Pod database** | structured rows you query and dedupe against                | you need to know what you already saw              |
| **Artifact**     | a browsable page at a URL                                   | the answer wants to be looked at, not read in chat |

Both stores mount **read-write** and neither has file locks. A SQLite file, git checkout or lockfile
on a store corrupts. Cursors and seen-ids go in a pod database.

## Where it belongs

Visibility is `private` or `org`, chosen once at create. A shared pod **cannot create anything
private** — route the user to their own workspace, offer the shared build as the alternative, and
carry the plan across. `references/placement.md`.

## Before saying "we don't support that"

Ask: can the source reach anything we have, or can anything we have reach it? Check what actually
wakes Ren first — a mapped Slack channel fires only on an @mention and **drops messages posted by
other apps**, so "the alert posts to the channel and Ren picks it up" never fires.
`references/composition.md`.

Search **both** surfaces before you call a connector missing — `ren mcps search --query X` and
`ren skills list --query X`. A skill with a credential is as much a connection as an MCP, and the
topology only shows what is already attached. `references/operations.md`.

## The outcome contract

A build is done when you can say, unprompted and in two sentences: **what wakes it · where output
lands · how often · how to stop or quiet it.** Nothing tells the user when a schedule starts failing,
so the off-switch is their only control.

## Ask, then act

| Situation                                 | Behaviour                                                         |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Reversible, private, you're confident     | One sentence, answerable in one word. Then do it.                 |
| Shared, scheduled, or costly if wrong     | One sentence naming trigger, destination, cadence. Then do it.    |
| Genuinely ambiguous **and** expensive     | Interview.                                                        |

Size the ask by risk, not by how many entities are involved. Never ask what the topology already
answers.

## Speak in outcomes

Default: no entity ids, version numbers, primitive names or CLI steps. Say what happens, when, and
where it lands. Match the user's register the moment they use platform vocabulary, ask how it works,
or drive the CLI themselves.

## References

| File                            | Read it when                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `references/topology.md`        | before answering what exists, or proposing structure                               |
| `references/placement.md`       | choosing visibility, or blocked by what this pod can create                        |
| `references/composition.md`     | designing ingress, or no direct connector exists                                   |
| `references/design-patterns.md` | choosing a primitive, or a cron/store/sandbox limit could bite                     |
| `references/artifacts.md`       | the output wants to be a page, or one needs refreshing or sharing                  |
| `references/operations.md`      | actually creating, attaching, uploading, scheduling, or handing back a session     |
| `references/authoring.md`       | writing a skill or a custom MCP                                                     |
| `references/permissions.md`     | restricting what tools may do, or gating one behind the user's approval            |
| `references/credentials.md`     | a skill or MCP needs auth, or one stopped working                                  |
| `references/channels.md`        | wiring Slack, Telegram, email, GitHub or Linear, or posting to them                |
| `references/blueprints.md`      | packaging a setup for reuse, or installing one                                     |
| `references/comparison.md`      | the user asks "why not just Zapier / ChatGPT / Claude Code"                        |

`ren docs model`, `ren docs integrations`, `ren docs commands` are the platform's own truth — read
them rather than recalling. The MCP transport exposes the same surface as `mcp__ren__*` tools.
