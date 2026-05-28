---

## name: project-dev
description: Create, configure, and manage projects within a pod - attaching agents, file stores, and memory stores. Use when the user wants to set up a project, change its agents, or attach stores.

# Project Dev

A project lives inside a pod and groups the agents, file/memory stores, and triggers for one scope of work. Agents attach as `primary`, `subagent`, or `all` (both at once - the default).

## Primary vs subagent

- **Primary** - a top-level assistant the user (or a trigger) talks to directly. Triggers and chat sessions route to the project's primary agent.
- **Subagent** - a specialised helper that a primary agent invokes for a specific task (e.g. an `Explore` agent doing read-only search).
- `**all`** (the attachment default) - the same agent is exposed both ways: usable as a direct chat agent *and* callable as a subagent from any other primary.

**CRITICAL: every project needs at least one agent attached as `primary` (or `all`).** Without one, triggers can't fire and chat sessions have nothing to land on.

## Lifecycle in the manifested sandbox

The project mounts into the pod sandbox at `/home/user/projects/{projectId}`; sessions land under `…/sessions/*/{outputs,uploads}`. The composed `opencode.json` for the project carries its agents' prompts, models, skills, and the mounted volume paths. Only **project-attached** agents can be triggered or chatted with, and the **primary** agent is the one triggers and sessions route to. Attaching/detaching an agent or store bumps the pod manifest and fans out - no restart.

Members are **pod-scoped, not project-scoped**: use separate projects for different outcomes inside one team; separate pods for different member sets (see [pod-dev]).

## Build via CLI

```
ren pods list --output json                                  # find the podId first
ren projects create --pod-id pod_… --name "My Project" --description "…"   # → projectId
```

Nested fields (`gitRepo`, `permission`) go through `--body`:

```
ren projects create --pod-id pod_… --name "My Project" \
  --body '{ "gitRepo": { "url": "…", "mountPath": "/repo" }, "permission": { … } }'
```

Attach agents and stores (managed per-attachment - no atomic "set the list"):

```
ren projects agents        add    prj_… --agent-id agt_primary --type primary
ren projects agents        add    prj_… --agent-id agt_helper  --type subagent   # or omit --type for "all"
ren projects agents        list   prj_…
ren projects agents        remove prj_… agt_helper                               # key is (projectId, agentId)

ren projects file-stores   add    prj_… --file-store-id   fst_…    # also: list / remove
ren projects memory-stores add    prj_… --memory-store-id mst_…    # also: list / remove
```

Default `--type` is `**all**` (primary + subagent), not `subagent`. Read with `ren projects get prj_…` (returns the project plus attached agents); list with `ren projects list --pod-id pod_…`.

## Build via MCP

`{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__project_create           { "body": { "podId": "pod_…", "name": "My Project" } }
mcp__ren__project_agent_add        { "path": { "id": "prj_…" }, "body": { "agentId": "agt_…", "type": "primary" } }
mcp__ren__project_fileStore_add    { "path": { "id": "prj_…" }, "body": { "fileStoreId": "fst_…" } }
mcp__ren__project_memoryStore_add  { "path": { "id": "prj_…" }, "body": { "memoryStoreId": "mst_…" } }
mcp__ren__project_get              { "path": { "id": "prj_…" } }
```

## Sessions

A **session** is one chat with the project's primary agent - the conversation a user (or a fired trigger) has inside the project. Creating a session is SDK/web-app only; the CLI is read-side, useful for inspecting what happened in a past run:

```
ren sessions list --project-id prj_… --output json
ren sessions get <session-id> --output json
ren sessions messages list <session-id> --output json
```

## Gotchas

- Stores are created in [file-memory-store-dev], then attached here - file store mounts `ro`, memory store mounts `rw`, both under `/volumes/<mountSlug>`.
- The internal attachment id is `pra_…` (`projectAgent`), and that's what a [trigger-dev] trigger pins to - **not** the agent id. Get it from `ren projects agents list <project-id>`.
- `project_agent_add` `type` default is `all` (both primary and subagent), not `subagent`. Pass `--type subagent` explicitly when you really want a helper-only.
- Don't reuse an existing project for a brand-new outcome; a fresh project keeps the agent isolated and trivial to throw away.

