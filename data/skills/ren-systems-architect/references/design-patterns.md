# Design patterns

What to reach for, where to put it, and the platform behaviour that is invisible from the API
surface. Commands are in `references/operations.md`.

**Signals** at the end of a section are what should make you offer it — after you deliver, never
mid-task.

## Contents

- [Reuse before you create](#reuse-before-you-create)
- [Pods and projects](#pods-and-projects)
- [Where behaviour comes from](#where-behaviour-comes-from)
- [Where to attach a capability](#where-to-attach-a-capability)
- [Instructions](#instructions--the-cheapest-primitive)
- [Stores and pod databases](#stores-and-volumes)
- [Triggers and sandboxes](#triggers--push-over-poll)
- [Artifacts and blueprints](#artifacts)
- [Working with a new user](#working-with-a-user-you-dont-know-yet)
- [Planning and delivery](#the-plan-you-keep)

## Reuse before you create

1. **Reuse** an existing registry, org or private skill or MCP as-is.
2. **Fork** a close-enough one and edit it — the baked-in domain knowledge is worth keeping.
3. **Author** only when neither fits.

Registry skills and MCPs are tested: inherit their commands, schemas and gotchas instead of
reasoning from scratch. `ren docs integrations` indexes what to reach for per task.

## Pods and projects

- **One private pod per user.** Build there for personal work; never create a second.
- **Shared pods are shaped around shared work, not the org chart** — a team, a warroom, a customer, a
  prod-vs-staging credential split. Ask "who else needs to see this?" before creating one.
- **A pod is one sandbox shared by every project in it**, which is why it is the credential and
  blast-radius boundary — a better reason for a new pod than a different member set.
- **Reuse a project whose scope already fits.** A project is not per-task: new work that belongs to
  an outcome already set up goes in that project, using what it already has. Create a new one only
  for a genuinely distinct scope — then it stays isolated and trivial to throw away.
- Members are **pod-scoped, not project-scoped**.

Already provisioned — reuse, don't recreate: the user's private pod, their personal vault, a default
file store and memory store, and the default "Ren" project.

## Where behaviour comes from

Everything a person asks to change about how the work runs resolves to one of the project's own
levers:

- Persona and stable behaviour → project instructions.
- Evolving facts, preferences, decisions, and history → relevant project memory.
- Capability → project skill or MCP.
- Model choice → project default model.
- What tools may do, or what needs approval first → project permissions
  (`references/permissions.md`).
- A genuinely distinct scope or outcome → a new project.

## Where to attach a capability

Attach new and user-created capabilities to the **project** so they travel with the outcome and Ren
receives them naturally. Existing system-owned capabilities on Ren stay unchanged.

- Pinned at both levels, **the highest semver wins** — not the narrower attachment — and the loser is
  reported as a pin conflict.
- A **null version pin is a deliberate pin to latest-live**, resolved at manifest build. Pinning a
  version freezes the snapshot. Both are worth naming when they matter.
- Archived skills and unresolvable dependencies are dropped silently; check
  `ren projects skills resolution`.
- Attaching or detaching propagates without a restart — the next session sees it.
- Tell Ren what the project now has: a store or repo absent from instructions can go unused.

## Instructions — the cheapest primitive

Standing knowledge belongs here, not in a longer prompt or repeated in every trigger message. **Put a
fact at the widest layer where it is true.**

| Layer                    | Holds                            |
| ------------------------ | -------------------------------- |
| Org instructions         | company facts                    |
| Pod instructions         | team facts                       |
| Project instructions     | this outcome's stable behaviour and standing rules |
| Store `AGENTS.md`        | how to use that store            |

Org, pod and project instructions are re-read before every model request, so unlike conversation
context they cannot be summarised away. The layers accumulate — a project runs with its pod's and the
org's text appended to its own — which makes them the home for doctrine: rules that must hold across
every session and every trigger fire, not just this thread. A correction worth keeping belongs here,
not repeated in the next message.

A store's `AGENTS.md` is seeded empty and is **iterable by both people and Ren** — update it when
the way the store is used changes. Because it enters the system prompt: describe **how to use this
store** only (never standing behaviour — that is an instructions layer), write under a provenance
line saying who wrote it and when, and keep it short.

**Signals:** you were told the same background fact twice; a correction that will apply to every
future run.

## Stores and volumes

Both kinds mount **read-write**. Neither has file locks — S3-backed FUSE with close-to-upload
semantics.

- **Never put a SQLite file, git checkout or lockfile on a store.** It corrupts or loses writes.
- Two projects on the same store see **the same bytes, not copies**: one prefix, two writers.
- Mount slug is **unique across both store types, org-wide** — a memory store `notes` blocks a file
  store `notes`.
- Caps: **50 MiB** per finalized upload, **5 MiB** for a direct write.
- Pod scratch is `/home/user/session-files`; a project may write only under its own sub-path.
- Don't attach empty stores speculatively, and don't upload the same content into a private and an
  org store — they are separate stores that drift.

## Pod databases

A real SQLite file at `/home/user/db/<slug>.db`, replicated off-box, shared by every project in the
pod. Query it; never hand-edit the file. This is where **cron state lives**: seen-ids, cursors, "did
I already report this". A memory store holds what the user prefers, not what the job has processed.

Always create it with `ren pod-databases create` before writing to it. That row is what gets the file
back after a sandbox rebuild; a SQLite file written straight into `/home/user/db/` does not survive
one (`references/operations.md`).

**Signals:** a scheduled job that would repeat itself; anything answering "what's new since last
time"; a digest that should stay silent when nothing changed.

## Triggers — push over poll

Use native or channel ingress when the source can push (`references/composition.md`). Fall back to
cron + a read-only MCP only when nothing can, and **say that you are polling**.

Addressing is part of the design: a mapped channel wakes Ren only on a mention, email only on the
project's own address. If the design depends on someone remembering to @-mention, say so at proposal
time.

| Behaviour                                                                     | Consequence                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Timezone defaults to **UTC**                                                  | "every morning at 9" becomes 9 UTC — set it explicitly, every time |
| A failing cron **keeps firing forever**; nothing pauses it, nothing tells anyone | the outcome contract's off-switch is the user's only safety      |
| A trigger on an **archived project** throws on every fire                     | still not disabled                                               |
| `until` is **inclusive**                                                      | the tick at `until` fires                                        |
| **No minimum interval** — `* * * * *` is accepted                             | nothing stops you scheduling something expensive                 |
| Fires open a **fresh session on the project**                                 | there is nothing to select or pin                                |
| Dispatch gets **one attempt, no retry**                                       | a tick lost to a sandbox that wouldn't come up is lost           |
| Overlapping runs are not serialised                                           | two runs share one sandbox — match cadence to expected runtime   |

Dry-run the same input from a real session before enabling, then verify the first scheduled fire with
`ren sessions list --project-id <prj_…>`.

**Signals:** "every", "each morning", "weekly"; work described on a rhythm; you just did by hand
something with a natural cadence.

## Sandboxes — what you can promise

One live sandbox per pod. It **pauses when idle** (~10 minutes) and wakes on demand; a busy box runs
up to ~3 hours. A fresh sandbox that doesn't report ready within 120s is discarded and rebuilt. Don't
promise "instant" on a sleeping pod.

## Artifacts

A page at a URL, owned by the pod, refreshed without changing the link. Offer one when the output has
the shape of a page — a long table, a chart, a report that will recur — the same way you offer a
schedule. Its URL is **unauthenticated**: possession of the link is read access, so say so when
handing it over. `references/artifacts.md`; how to build one is in Ren's `ren-artifact` skill.

**Signals:** you just put a forty-row table in a message; the same summary is due again next week; the
user says "send me a link" or asks to show someone else.

## Blueprints are demand-driven

Never proposed proactively. A blueprint happens when the user says share, reuse, or give this to
others.

## Missing credentials

Name the service, name the place, never ask in chat. The destination follows from the pod.
`references/credentials.md`.

## Working with a user you don't know yet

Read before you propose. The topology says how their workspace is arranged; their memory store says
how they work — `WHOAMI.md` in the default memory store, plus whatever past runs recorded. Build a
picture of what they do day to day, what they keep repeating, and what they have already automated,
then say it back in two or three sentences before proposing anything.

- **Let explorers explore.** If they ask how Ren works and have no concrete task, explain it and do
  not build unless they ask.
- **For a concrete task, ship one real thing** — the recurring work they actually named, working,
  rather than a tour of three primitives. If they gesture at a whole stack, build the most important
  piece and name the rest.
- **Match their register** — someone who says "fork the skill into my scope" gets mechanics; someone
  who says "it should just email me the numbers" gets outcomes.
- **If they won't engage with the requirement**, stop asking and hand back a working session anyway.
- **Close with concrete reasons to come back**, at most two: a schedule for what they just did, a
  shareable replay of the run (`ren replays share`), moving what their local coding tool already knows into
  the memory store, or the next piece of the stack.
- **Write what you learned to the memory store** — who they are, what was built, what they declined.

## The plan you keep

Keep a plain markdown plan file for anything with several moving parts. It is yours: don't narrate
it, don't make the user co-author it, and re-read it from disk each iteration rather than trusting
context.

- **Redirected across pods** → write the plan to a file store both pods reach and hand over the
  reference, so the user resumes instead of being re-interviewed.
- **Proposal declined** → one line to the memory store (_"declined a daily deploy-digest cron on
  <date>"_). Read those before proposing again.
- The strict slug-keyed spec document survives **only for blueprints**, where push and the resolution
  gate need it.

## Build order

Build leaf-up and verify each result before moving on: **environment → project → instructions and
default model → skills/MCPs → stores/databases → channel or trigger → verify a real run.**
Credentials are orthogonal — wire them when the thing that needs them is built.

## After you deliver

Offer at most one thing:

- It will recur the same way → make it durable (schedule, or ingress if the source can push).
- It could have happened unasked → proactive delivery to a channel the user reads.
- It was awkward to serve — you worked around a missing capability → attach what was missing so the
  next one is a clean delegation.
- The answer wanted to be looked at, not read → an artifact, and a refresh on the same cadence as its
  data.

If it was genuinely one-off, say nothing. A force-fitted suggestion is worse than none.
