# Tasks

A task is one concrete thing to do, with an owner, a status and a trail. It outlives the conversation
that created it: `ren tasks list` is what a person — or a later run — reads to find what is still
owed. Commands are in `references/operations.md`.

## When it's the right answer

Reach for a task when the next step **outlives this conversation** and someone has to pick it up.

- **TodoWrite** holds the steps of this session and dies with it; a task survives it. Never mirror
  TodoWrite items into tasks.
- **A memory store** holds what you *know* — facts, preferences, decisions. A task holds what is
  *owed* — an intent, an owner, a status. _"We use pnpm"_ is memory; _"migrate CI to pnpm"_ is a
  task.
- **A cron** is *when* work happens; a task is *what* work is owed. They compose — a schedule can
  drain the list — but a task on its own runs nothing.
- **An external tracker** — Linear, GitHub issues — is an **org preference, not a content rule**.
  Follow what org instructions or memory already say. When nothing is recorded and a tracker is bound
  to this org, ask once with the `question` tool, then write the answer into org instructions. Never
  split one stream of work across both surfaces.

Stay in chat when the follow-up is doable now. **A task is not a substitute for doing the work.**

## Before you create one

Read `ren tasks list --include-done` first. The default list hides the two things that should stop
you:

- a **`dismissed` twin** means the idea was already rejected. Do not resurrect it.
- an **`open` twin** means the task already exists. Update that one rather than filing a duplicate.

## Scope

Org-wide by default, visible to every org member. Attach it to a pod or a project with `--pod-id` /
`--project-id` when the work belongs there; then only that pod's members see it. Setting a project
pins its pod.

## Owner, project and start

`--assigned-to-user-id` is who **owes** the task; `--project-id` is the project whose Ren agent
**works** it. Either, both, or neither. A human assignee must be a member of the org, and of the pod
when the task is pod-scoped.

Assigning never runs anything. `ren tasks start <tsk_…> --mode continue` runs the assigned project's
agent, resuming the session that agent last worked the task in (a task you create from a chat counts
as worked in that chat), or opening a new one; `--mode new` always opens a new one. To hand work to
another project: `ren tasks update <tsk_…> --project-id <prj_…>`, then `ren tasks start`.

A GitHub pull request, Linear issue or Slack thread in the task's links routes messages there to the
assigned project's session, so a reply on the PR or issue reaches the agent working the task.

## Status is a vocabulary, not a workflow

`open` → `in_progress` → `done`, and nothing enforces the order — say where the task actually is
rather than walking it through the states.

`dismissed` is the fourth value: a suggestion somebody turned down. Never record a rejected idea as
`done` and never archive it — both hide it from the `--include-done` read, and the next run proposes
the same thing again.

## The trail

`ren tasks get` returns the activity trail embedded — who created the task, every status change,
every reassignment, and the actor behind each. Read it before editing a task you did not create, so
you don't undo someone else's decision. Pass `--include-events=false` only when current state is all
you need.

**Signals:** you finished something and named a follow-up you cannot do now; a suggestion was
accepted but nobody can act on it yet; the same reminder has come up twice in chat; a scheduled run
found an opportunity worth keeping without interrupting anyone.
