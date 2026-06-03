---
name: ren-sessions-dev
description: >-
  Create, inspect, and deep-link sessions - the individual chats a user or a
  fired trigger has with a project's primary agent. Use when the user wants to
  start a session, read what happened in a past run, or get a link to one.
---

# Session Dev

A **session** is one chat with a project's primary agent — the conversation a user (or a fired trigger) has inside the project. A session lives under a project, so the project must already have a primary agent attached (see [[ren-project-dev]]).

## Runtime behavior

Creating a session opens a fresh conversation against the project's primary agent; the pod's sandbox must be `ready` for it to load (Ren wakes a paused sandbox on demand; a `failed` sandbox blocks it — see [[ren-pod-dev]]). A trigger creates one session per fire ([[ren-trigger-dev]]). The CLI/MCP is both write-side (create) and read-side (inspect a past run's messages).

## Scope

See [[ren-scope]]. A session inherits its project's scope — if the project is in a user-private pod, every command needs `--scope user` (CLI) / `"query": { "scope": "user" }` (MCP).

## Build via Ren CLI

```
ren sessions create --pod-id pod_… --project-id prj_… --title "…"   # needs a primary agent attached
ren sessions list --project-id prj_… --output json
ren sessions get <session-id> --output json
ren sessions messages list <session-id> --output json
ren sessions url <session-id>                                       # OpenCode URL for the session
```

## Build via Ren MCP

`{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__session_create        { "query": { "scope": "user" }, "body": { "podId": "pod_…", "projectId": "prj_…", "title": "…" } }
mcp__ren__session_list          { "query": { "scope": "user", "projectId": "prj_…" } }
mcp__ren__session_get           { "query": { "scope": "user" }, "path": { "id": "<session-id>" } }
mcp__ren__session_url           { "query": { "scope": "user" }, "path": { "id": "<session-id>" } }
mcp__ren__session_messages_list { "query": { "scope": "user" }, "path": { "id": "<session-id>" } }
```

## URLs — two different kinds

A session has **two** URLs. Pick by what the user wants.

### 1. Ren UI link (the web app) — hand-built

No command returns it; construct it yourself. Base is `${REN_APP_URL}` when a shell resolves it, else the prod SPA `https://renai.build/app` (no-shell / MCP transport — never emit a `localhost` link):

```
<base>/pods/<podId>/projects/<projectId>/sessions/<sessionId>
<base>/pods/<podId>/projects/<projectId>
```

This is what you hand a user to open the session in the Ren UI. Default to this for human hand-off.

### 2. OpenCode sandbox URL — from `sessions url`

`ren sessions url <session-id>` / `session_url` returns the **sandbox's** OpenCode URL (`<publicHost>/<dir>/session/<id>`), pointing straight at the running server. It's gated by **HTTP basic auth**:

- **username** — always `opencode`
- **password** — the sandbox's `serverPassword`, read from the **status of the pod that contains the session's project** (returned only when status is `ready`):

```
ren pods sandboxes status <pod-id> --output json        # → .serverPassword
mcp__ren__pod_sandbox_status { "query": { "scope": "user" }, "path": { "podId": "pod_…" } }   # → { status: "ready", sandbox, serverPassword }
```

So the full flow for a sandbox URL: `session_get` → its `podId` → `pod_sandbox_status` for the password → `session_url` for the URL → present as `https://opencode:<serverPassword>@<host>/…` or hand the URL plus the `opencode` / `<serverPassword>` credentials.

## Gotchas

- A session needs the project to have a primary agent attached — `create` against a project with none has nothing to land on (see [[ren-project-dev]]).
- `ren sessions create` takes both `--pod-id` and `--project-id`; the project must belong to that pod.

## Next steps

- **Read what happened** — `ren sessions messages list <session-id>` after a manual run or a trigger fire to inspect the transcript.
- **Run it unattended** with a cron trigger once a manual session is clean. See [[ren-trigger-dev]].
- **Make the agent better at the task** based on what the session surfaced — update its prompt or skills. See [[ren-agent-dev]].
