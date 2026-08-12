# Topology

`ren topology get` returns the whole visible graph in one call.

## The gate

Run it before:

1. any "do we have / is X connected / what's running / who has access" answer, and
2. any proposal of new structure.

Re-run it after you build something, and after a long conversation, rather than trusting your memory
of it.

## What comes back

`meta`, `agents`, `pods`, `projects` always; the rest are omitted when empty.

| Key                             | Tells you                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `meta`                          | organisation name                                                                |
| `pods`                          | every pod you can see, private and shared                                        |
| `projects`                      | which pod each project is in, and any git repositories bound to it               |
| `agents`                        | each agent's skills and MCPs, and which projects it is attached to               |
| `mcps`, `credentials`, `vaults` | what tool surfaces exist and which credential backs each                         |
| `fileStores`, `memoryStores`    | stores and the projects they are attached to                                     |
| `slack`, `github`, `emails`     | which channel, repo or mailbox answers as which project                          |
| `triggers`                      | cron triggers with schedules and standing instructions                           |

Not in the graph — query directly: pod databases (`ren pod-databases list <pod-id>`), artifacts
(`ren artifacts list`), Telegram chats (`ren telegram chats list`), Linear mappings
(`ren linear mappings list`).

## Honesty rule

The graph is viewer-scoped: your pods plus the org's shared pods, never a colleague's private
workspace. Say **"I don't see"**, not "we don't have". If it might exist outside your view, say where
to check.

## Identity rule

In a shared pod you are **not told who is speaking**. `<workspace_context>` carries pod, project and
connected channels — not the human. Channel turns carry `<current_message from="…">`; live shared-pod
turns carry nothing.

The topology is scoped by the real viewer, so the private pod it shows is this user's. Use that; do
not interrogate the user for their own identity.

Cron turns are attributed too — a cron always runs as whoever created it.

## Read the graph proactively

Note these; raise at most one, after delivering what was asked.

- A project doing recurring work with **no trigger**.
- A **cron whose instruction names no destination** — output lands nowhere anyone reads.
- An **MCP with no credential** behind it: every call fails at the call site.
- A **channel mapped to an empty project**, or a project whose only agent was detached.
- A **memory store nobody reads**.
- **Two projects on one store** writing the same paths: one prefix, two writers, no locks.
- A **trigger on an archived project**: every fire throws, nothing disables it.

## Attachment is not resolution

Archived skills and unresolvable dependencies are dropped from the running agent silently — the
attachment stays. `ren projects skills resolution <project-id>` shows what actually loaded, including
which pin won when the same skill is pinned twice.
