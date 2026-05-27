---
name: project-dev
description: Create, configure, and manage projects within a pod — attaching agents, file stores, and memory stores. Use when the user wants to set up a project, change its agents, or attach stores.
---

# Project Dev

A project lives inside a pod and groups the agents, file/memory stores, and triggers for one outcome. Agents attach as `primary` or `subagent`.

## Lifecycle in the manifested sandbox

The project mounts into the pod sandbox at `/home/user/projects/{projectId}`; sessions land under `…/sessions/*/{outputs,uploads}`. The composed `opencode.json` for the project carries its agents' prompts, models, skills, and the mounted volume paths. Only **project-attached** agents can be triggered or chatted with, and the **primary** agent is the one triggers and sessions route to. Attaching/detaching an agent or store bumps the pod manifest and fans out — no restart.

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

Attach agents and stores (managed per-attachment — no atomic "set the list"):

```
ren projects agents        add    prj_… --agent-id agt_primary --type primary
ren projects agents        add    prj_… --agent-id agt_helper  --type subagent
ren projects agents        list   prj_…
ren projects agents        remove prj_… agt_helper

ren projects file-stores   add    prj_… --file-store-id   fst_…    # also: list / remove
ren projects memory-stores add    prj_… --memory-store-id mst_…    # also: list / remove
```

Default `--type` is `subagent`. Every project needs at least one `primary`. Read with `ren projects get prj_…` (returns the project plus attached agents); list with `ren projects list --pod-id pod_…`.

## Build via MCP

```
mcp__ren__project_create           { "podId": "pod_…", "name": "My Project" }
mcp__ren__project_agent_add        { "id": "prj_…", "agentId": "agt_…", "type": "primary" }
mcp__ren__project_fileStore_add    { "id": "prj_…", "fileStoreId": "fst_…" }
mcp__ren__project_memoryStore_add  { "id": "prj_…", "memoryStoreId": "mst_…" }
mcp__ren__project_get              { "id": "prj_…" }
```

## Gotchas

- Stores are created in [file-memory-store-dev], then attached here — file store mounts `ro`, memory store mounts `rw`, both under `/volumes/<mountSlug>`.
- The attachment id returned by `agents add` (`projectAgentId`) is what a [trigger-dev] trigger pins to — not the agent id.
- Don't reuse an existing project for a brand-new outcome; a fresh project keeps the agent isolated and trivial to throw away.
