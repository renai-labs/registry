---
name: ren-project-dev
description: Create, configure, and manage projects within a pod - attaching agents, file stores, and memory stores. Use when the user wants to set up a project, change its agents, or attach stores.
---

# Project Dev

A project lives inside a pod and groups the agents, file/memory stores, and triggers for one scope of work. Agents attach as `primary`, `subagent`, or `all` (both at once - the default).

## Primary vs subagent

- **Primary** - a top-level assistant the user (or a trigger) talks to directly. Triggers and chat sessions route to the project's primary agent.
- **Subagent** - a specialised helper that a primary agent invokes for a specific task (e.g. an `Explore` agent doing read-only search).
- **`all`** (the attachment default) - the same agent is exposed both ways: usable as a direct chat agent *and* callable as a subagent from any other primary.

**Every project needs at least one agent attached as `primary` (or `all`).** Without one, triggers can't fire and chat sessions have nothing to land on.

## Runtime behavior

The project is what binds agents, stores, and triggers to a pod. Attaching (or detaching) an agent or a store propagates without restart — the next session sees it.

An agent attachment **tracks the agent's latest version by default**: omit `agentVersionId` (or pass `null`) on `projects agents add`, and a new published agent version rolls out to this project automatically. Pass an explicit `agentVersionId` to freeze the snapshot — useful when you want stability while the agent is iterated elsewhere.

## Scope

See [[ren-scope]]. A project inherits its pod's scope — if the pod is user-private, every project command needs `--scope user` (CLI) / `"query": { "scope": "user" }` (MCP).

## Build via Ren CLI

```
ren pods list --output json
ren projects create --pod-id pod_… --name "My Project" --description "…"
```

Nested fields (`gitRepo`, `permission`) go through `--body`:

```
ren projects create --pod-id pod_… --scope user --name "My Project" \
  --body '{ "gitRepo": { "url": "…", "mountPath": "/repo" }, "permission": { … } }'
```

Attach agents and stores (managed per-attachment - no atomic "set the list"):

```
ren projects agents        add    prj_… --agent-id agt_primary --type primary                   # tracks agent's latest version
ren projects agents        add    prj_… --agent-id agt_helper  --type subagent
ren projects agents        add    prj_… --agent-id agt_primary --agent-version-id agv_… --type primary   # pinned
ren projects agents        list   prj_…
ren projects agents        remove prj_… agt_helper

ren projects file-stores   add    prj_… --file-store-id   fst_…    # also: list / remove
ren projects memory-stores add    prj_… --memory-store-id mst_…    # also: list / remove
```

Read with `ren projects get prj_…` (returns the project plus attached agents); list with `ren projects list --pod-id pod_…`.

## Build via Ren MCP

`{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__project_create           { "query": { "scope": "user" }, "body": { "podId": "pod_…", "name": "My Project" } }
mcp__ren__project_agent_add        { "query": { "scope": "user" }, "path": { "id": "prj_…" }, "body": { "agentId": "agt_…", "type": "primary" } }
mcp__ren__project_agent_add        { "query": { "scope": "user" }, "path": { "id": "prj_…" }, "body": { "agentId": "agt_…", "agentVersionId": "agv_…", "type": "primary" } }
mcp__ren__project_fileStore_add    { "query": { "scope": "user" }, "path": { "id": "prj_…" }, "body": { "fileStoreId": "fst_…" } }
mcp__ren__project_memoryStore_add  { "query": { "scope": "user" }, "path": { "id": "prj_…" }, "body": { "memoryStoreId": "mst_…" } }
mcp__ren__project_get              { "query": { "scope": "user" }, "path": { "id": "prj_…" } }
```

## Sessions

A **session** is one chat with the project's primary agent - the conversation a user (or a fired trigger) has inside the project. Create one, inspect past runs, and fetch its live OpenCode URL — all from the CLI or MCP. **Creating a session needs the pod's sandbox `ready`** (see [[ren-pod-dev]]); `sessions url` returns 400 until a sandbox is live.

CLI:

```
ren sessions create --scope user --pod-id pod_… --project-id prj_… --title "…" --output json
ren sessions url    <session-id> --scope user --output json   # → { "url": "https://<sandbox>/<dir>/session/<id>" }
ren sessions list   --project-id prj_… --output json
ren sessions get    <session-id> --output json
ren sessions messages list <session-id> --output json
```

MCP:

```
mcp__ren__session_create { "query": { "scope": "user" }, "body": { "podId": "pod_…", "projectId": "prj_…", "title": "…" } }
mcp__ren__session_url    { "query": { "scope": "user" }, "path": { "id": "ses_…" } }
```

Hand off **both** links — the Ren web app (full session UI, replays, settings) and the OpenCode URL (drops straight into the agent TUI):

```
${REN_APP_URL}/pods/<podId>/projects/<projectId>/sessions/<sessionId>   # Ren web app
<url from `ren sessions url`>                                           # direct OpenCode TUI
```

## Gotchas

- Members are **pod-scoped, not project-scoped**: use separate projects for different outcomes inside one team; separate pods for different member sets (see [[ren-pod-dev]]).
- The internal attachment id is `pra_…` (`projectAgent`), and that's what a [[ren-trigger-dev]] trigger pins to - **not** the agent id. Get it from `ren projects agents list <project-id>`.
- Don't reuse an existing project for a brand-new outcome — a fresh project keeps the agent isolated and trivial to throw away.

## Next steps

- **Start a session** — `ren sessions create …` (or `mcp__ren__session_create`), then confirm the agent loads cleanly via the Ren deep link or the OpenCode URL above. The pod's sandbox must be `ready`; see [[ren-pod-dev]].
- **Run it unattended** with a cron trigger — only after one clean manual session. See [[ren-trigger-dev]].
- **Give the agent more context** by attaching a file store (uploads / reference docs, read-only) or a memory store (persistent learnings, read-write). See [[ren-file-memory-store-dev]].
- **Wire missing credentials** if a session surfaces a missing API key or OAuth. See [[ren-vaults-credentials-dev]].
