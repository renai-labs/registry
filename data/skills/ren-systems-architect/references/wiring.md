# Ren wiring — the plumbing primitives

The containers and plumbing that hold a build together: pods (and sandbox readiness), projects (and sessions), stores, and triggers. The architect body owns the arrangement decisions; this file is the mechanics. Commands and flags: `ren docs commands`. Cross-references between these primitives are intra-document (§Pods, §Projects, …).

## Pods

A pod is one durable sandbox plus a member set of users and agents. Agents run inside this sandbox; everything attached to the pod (skills, MCPs, stores, vaults) is available to every project in it. A pod is the unit of isolation: different member sets or credential boundaries → different pods. (How to _choose_ pod boundaries: architect body, "How to arrange pods & projects.")

### Finding a pod

A new org automatically gets both a private pod (yours) **and** a general org pod; older accounts may have only the org pod. List with **both** scopes if you don't know where to build — `ren pods list --scope user` (private) and `ren pods list` (org). Look for `isPrivate: true, isDefault: true` to spot the user's private pod.

### Scope

The **private pod** lives in your user namespace; every pod command targeting it needs `--scope user`.

### Sandbox readiness — check before handing off a session

Session creation fails with _"Pod has no live sandbox"_ if the sandbox is paused or absent. Always check first with `ren pods sandboxes status <pod-id> --scope user --output json`. The response is a discriminated union on `status`:

- `ready` → live, proceed.
- `provisioning` → in flight; poll again without yielding to the user.
- `absent` → kick off `ren pods sandboxes provision <pod-id> --scope user`, then poll to `ready`. `provision` is **idempotent** and **resumes a paused sandbox** rather than building a fresh one.
- `failed` → the response carries `reason`. Surface it plainly and stop; don't retry on autopilot.

A `ready` status also returns `serverPassword` — the HTTP-basic password (username `opencode`) for the sandbox's raw OpenCode URL, if you ever need it.

### Attaching & members

- **Attach a vault** to share credentials across the pod's projects: `ren pods vaults add <pod-id> --vault-id vlt_… --priority 0`. Attach priority matters — lower number wins on credential-name conflicts across attached vaults. See [[ren-vaults-credentials-dev]].
- **Add teammates** with `ren pods members add` if this is a shared pod. Members are **pod-scoped, not project-scoped**.

## Projects

A project lives inside a pod and groups the agents, file/memory stores, and triggers for one scope of work. Commands: `ren projects create / get / list`, `ren projects agents|file-stores|memory-stores add/list/remove`. Scope inherits from the pod.

### Primary vs subagent

Agents attach as `primary`, `subagent`, or `all` (both at once — the default).

- **Primary** — a top-level assistant the user (or a trigger) talks to directly. Triggers and chat sessions route to the project's primary agent.
- **Subagent** — a specialised helper a primary agent invokes for a task (e.g. an `Explore` agent doing read-only search).
- **`all`** (the attachment default) — the same agent is exposed both ways: a direct chat agent _and_ callable as a subagent from any other primary.

**Every project needs at least one agent attached as `primary` (or `all`).** Without one, triggers can't fire and chat sessions have nothing to land on.

An agent attachment **tracks the agent's latest version by default** (omit `agentVersionId` on `projects agents add`); pass an explicit `agentVersionId` to freeze the snapshot. Attaching or detaching an agent or store propagates without restart — the next session sees it.

### Sessions

A **session** is one chat with the project's primary agent (a user's, or one a fired trigger opens). The sandbox must be `ready` for it to load (§Pods). `ren sessions list / get / messages list` inspect past runs; `session.create` itself is SDK/web-app only. Hand a user the Ren UI deep link `<base>/pods/<podId>/projects/<projectId>/sessions/<sessionId>` (see the onboarding hand-off for base-URL rules).

### Gotchas

- Members are **pod-scoped, not project-scoped**: separate projects for different outcomes inside one team; separate pods for different member sets (§Pods).
- The internal attachment id is `pra_…` (`projectAgent`), and that's what a cron trigger pins to — **not** the agent id. Get it from `ren projects agents list <project-id>`.
- Don't reuse an existing project for a brand-new outcome — a fresh project keeps the agent isolated and trivial to throw away.

## Stores

Two volume types, both durable, both attach to a **project**:

- **File store** — **read-only** for the agent. Users upload artifacts (docs, datasets, reference material) so the agent has better context. The agent reads them; it can't write back.
- **Memory store** — **read-write** for the agent. Where the agent persists what it learns across sessions and runs: lessons from past conversations, user/team preferences and tastes, reusable decision-making frameworks.

Commands: `file-stores` / `memory-stores` create/get/list/archive, the `files` subcommands, `projects … add`. Once attached, a store is available the next time the agent runs (no restart) and the agent's prompt is told where to find it.

### Uploading files (start → PUT → finalize)

Both store types use the **same three-step flow** and the same `files` subcommands. Per-file cap **50 MB**. Neither the CLI nor MCP transfers bytes for you — step 2 is a raw HTTP `PUT` you run yourself.

Step 1 `start-upload` returns `{ "url": "<presigned PUT target>", "expiresAt": "..." }` — the field is `url` (not `uploadUrl`), and there is no file id. Step 2 PUTs the raw bytes to that url (use the exact byte count from `--size`). Step 3 `finalize-upload` is keyed by `--path` only (the same path as step 1), no file id.

Worked example for a **memory store** via CLI (file stores are identical — swap `memory-stores`→`file-stores` and `mst_`→`fst_`):

```bash
ren memory-stores files start-upload <mst_…> --scope user --path "preferences.md" --size 1234 --output json
curl -X PUT --data-binary @preferences.md "<url-from-step-1>"
ren memory-stores files finalize-upload <mst_…> --scope user --path "preferences.md" --output json
```

Via MCP you still PUT the bytes to the returned `url` between the `startUpload` and `finalizeUpload` calls. Exact schema:

```
start-upload  body:     { path: string, size: int (bytes, ≤ 50 MB), contentType?: string }
start-upload  response: { url: string, expiresAt: ISO-8601 }   # no file id
finalize      body:     { path: string }                       # same path; no file id
```

### Attaching to a project

A store does nothing until it's attached to a project. **Attach is not idempotent — list before you add.** Re-attaching a store that's already on the project violates a unique constraint and surfaces as an ugly **500** (not a 400/409):

```
Failed query: insert into "project_memory_store" ... [500]
```

That specific 500 means _already attached_ — treat it as success, don't retry. To avoid it, `ren projects memory-stores list <prj_…>` first and only add if it's not already there.

### Gotchas

- **Pick one scope — don't upload the same memories into both a user and an org store.** `--scope user` creates a _private_ store (`userId` set); `--scope org` creates a _shared_ one (`userId` null). They are distinct stores even with the same name. Onboarding a single user → `user`. Seeding shared team memory → `org`. Uploading the same files to both leaves two divergent copies that drift apart.
- Attaching a store is **not idempotent** — re-adding an attached store 500s with a `project_*_store` duplicate error. List first.
- The same memory store attached to two projects is one piece of state: concurrent writers see each other's files.
- Don't attach empty stores speculatively.
- Tell the agent the store exists — update its prompt to mention what's in the file store or what the memory store is for (→ [[ren-agent-dev]]).

## Triggers

A trigger runs a project's **primary** agent without anyone manually starting a session. It's pinned to a `projectAgent` (the agent's attachment to a project, id prefix `pra_`), so the project must already have a primary agent attached (§Projects). Today only **cron** triggers are in scope (id prefix `ctrg_`) — fire on a schedule with a fixed input message. Commands: `triggers create / update`.

### Runtime behavior

A trigger opens a fresh session against the project's primary agent on each fire, with `inputMessage` as the first user turn. The sandbox must be `ready` when it fires — Ren wakes a paused sandbox on demand, but a `failed` sandbox blocks the fire (§Pods). Toggling `isEnabled` propagates on the next manifest refresh; you don't need to recreate the trigger.

### Gotchas

- The `projectAgentId` is the **attachment id** (`pra_…`), not the agent id (`agt_…`). Get it from `ren projects agents list <project-id>`.
- `--schedule` is a 5-field cron expression; always set `--timezone` or it runs in the org default (UTC).
- `triggers update` needs `--project-id` too — it's the auth-scope key, not a change field.
- Prefer enabling a trigger only after a manual dry-run of the same input has been verified end-to-end from a real session — once the cron is live, any unnoticed failure mode keeps recurring on every fire.
- **Verify a fire** via `ren sessions list --project-id prj_…` after the first scheduled run — the trigger spawns a real session you can inspect.
