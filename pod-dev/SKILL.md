---
name: pod-dev
description: Inspect and manage pods — the durable sandbox boundary that runs agents. Use when the user wants to find a pod, check or wake its sandbox, add members, or attach vaults. Read this before any build, to know where the work will live.
---

# Pod Dev

A pod is one durable sandbox (a real VM/container) plus a member set of users and agents. Agents execute *inside* this sandbox — compute, files, memory, and resolved credentials all live here. A pod is the unit of isolation: different member sets or credential boundaries → different pods.

## Lifecycle in the manifested sandbox

The pod owns the sandbox. The server compiles a **manifest snapshot** for the pod (`projects`, `environment`, `members`, `podVolume`) and the sandbox watches `manifestUpdatedAt` — **every create or attach anywhere in the pod bumps it, and the change fans out into the running sandbox.** You don't restart anything.

- The sandbox home is `/home/user`. Projects mount under `/home/user/projects/{projectId}`; the pod-wide volume mounts at `/home/user/artifacts` (rw, S3-backed).
- Attached vaults are walked in **priority order** to resolve credentials at agent startup (see [credentials-dev]).
- Members in the manifest gate who can open sessions against the pod.
- Sandboxes **pause and resume** — they are not ephemeral. A paused pod is not a dead pod; `provision` resumes it.

## Sandbox readiness — check before handing off a session

Session creation fails with *"Pod has no live sandbox"* if the sandbox is paused or absent. Always check first.

```
ren pods sandboxes status <pod-id> --output json
```

Response is a discriminated union on `status`:

- `ready` → live, proceed.
- `provisioning` → in flight; poll again. Do **not** yield to the user between polls.
- `absent` → none linked; kick off provisioning, then poll to `ready`:
  ```
  ren pods sandboxes provision <pod-id> --output json
  ```
  Provision is **idempotent** (concurrent calls join the same workflow) and **resumes a paused sandbox** rather than building a fresh one.
- `failed` → the response carries `reason`. Surface it plainly and stop; don't retry on autopilot.

## Build via CLI

```
ren pods list --output json                 # find the pod; isPrivate + isDefault mark the user's private pod
ren pods get <pod-id> --output json
ren pods sandboxes status   <pod-id> --output json
ren pods sandboxes provision <pod-id> --output json
ren pods members add    <pod-id> --user-id usr_…   # also: members list / remove
ren pods vaults add     <pod-id> --vault-id vlt_…  # also: vaults list / remove
```

## Build via MCP

Same surface, tool-call shape (params are the API field names):

```
mcp__ren__pod_list {}
mcp__ren__pod_sandbox_status     { "podId": "pod_…" }
mcp__ren__pod_sandbox_provision  { "podId": "pod_…" }
mcp__ren__pod_member_add         { "podId": "pod_…", "userId": "usr_…" }
mcp__ren__pod_vault_add          { "podId": "pod_…", "vaultId": "vlt_…" }
```

## Gotchas

- Read the pod list shape — don't assume. A new org gets a private pod **and** a general org pod; older accounts may have only the org pod. Build wherever the user actually has a project.
- Members are **pod-scoped, not project-scoped**. Use separate projects for different outcomes inside one team; separate pods for different member sets.
- A pod-scoped (`--scope user`) personal pod is queried with `--scope user` on `pods list` if it lives in the user namespace.
