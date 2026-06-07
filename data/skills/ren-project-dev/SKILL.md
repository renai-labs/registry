---
name: ren-project-dev
description: >-
  Create, configure, and manage projects within a pod - attaching agents, file
  stores, and memory stores. Use when the user wants to set up a project, change
  its agents, or attach stores.
metadata:
  icon: 'https://cdn.renai.build/skill-icons/project-dev.svg'
  tags:
    - productivity
    - code
    - ren
---

# Project Dev

A project lives inside a pod and groups the agents, file/memory stores, and triggers for one scope of work. Agents attach as `primary`, `subagent`, or `all` (both at once - the default).

> Commands and flags (`projects create / get / list`, `projects agents|file-stores|memory-stores add/list/remove`): `ren docs commands`. Scope inheritance from the pod and attachment-version roll-forward: `ren docs model`. This skill is the attachment model and gotchas.

## Primary vs subagent

- **Primary** - a top-level assistant the user (or a trigger) talks to directly. Triggers and chat sessions route to the project's primary agent.
- **Subagent** - a specialised helper that a primary agent invokes for a specific task (e.g. an `Explore` agent doing read-only search).
- **`all`** (the attachment default) - the same agent is exposed both ways: usable as a direct chat agent *and* callable as a subagent from any other primary.

**Every project needs at least one agent attached as `primary` (or `all`).** Without one, triggers can't fire and chat sessions have nothing to land on.

An agent attachment **tracks the agent's latest version by default** (omit `agentVersionId` on `projects agents add`); pass an explicit `agentVersionId` to freeze the snapshot. Attaching or detaching an agent or store propagates without restart — the next session sees it.

## Sessions

A **session** is one chat with the project's primary agent (a user's, or one a fired trigger opens). The sandbox must be `ready` for it to load ([[ren-pod-dev]]). `ren sessions list / get / messages list` inspect past runs; `session.create` itself is SDK/web-app only. Hand a user the Ren UI deep link `<base>/pods/<podId>/projects/<projectId>/sessions/<sessionId>` (see the onboarding hand-off for base-URL rules).

## Gotchas

- Members are **pod-scoped, not project-scoped**: use separate projects for different outcomes inside one team; separate pods for different member sets (see [[ren-pod-dev]]).
- The internal attachment id is `pra_…` (`projectAgent`), and that's what a [[ren-trigger-dev]] trigger pins to - **not** the agent id. Get it from `ren projects agents list <project-id>`.
- Don't reuse an existing project for a brand-new outcome — a fresh project keeps the agent isolated and trivial to throw away.

## Next steps

- **Start a session** — confirm the agent loads cleanly. The pod's sandbox must be `ready` ([[ren-pod-dev]]).
- **Run it unattended** with a cron trigger — only after one clean manual session. See [[ren-trigger-dev]].
- **Give the agent more context** by attaching a file store (uploads / reference docs, read-only) or a memory store (persistent learnings, read-write). See [[ren-file-memory-store-dev]].
- **Wire missing credentials** if a session surfaces a missing API key or OAuth. See [[ren-vaults-credentials-dev]].
