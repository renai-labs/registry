---
name: pod-dev
description: Inspect and manage pods - the durable sandbox boundary that runs agents. Use when the user wants to find a pod, check or wake its sandbox, add members, or attach vaults. Read this before any build, to know where the work will live.
---

# Pod Dev

A pod is one durable sandbox plus a member set of users and agents. Agents run inside this sandbox; everything attached to the pod (skills, MCPs, stores, vaults) is available to every project in it. A pod is the unit of isolation: different member sets or credential boundaries → different pods.

## How to arrange pods

One **private pod per user** for personal work. **Team pods are shaped around shared work, not necessarily the org chart** - a sales team, an emergency warroom, a per-customer pod, a prod-vs-staging credential split. The axes are orthogonal; ask the user "who else needs to see this?" before creating.

## Scope — your private pod lives in your user namespace

Your **private pod** lives in your user namespace. The default `pods list` only returns **org** pods, so a private-pod build silently fails to find anything.

```
ren pods list --scope user --output json                              # CLI
mcp__ren__pod_list { "query": { "scope": "user" } }                   # MCP
```

A new org automatically gets both a private pod (yours) **and** a general org pod; older accounts may have only the org pod. Always list with **both** scopes if you don't know where the user wants to build:

```
ren pods list             --output json   # org pods
ren pods list --scope user --output json   # your private pod
```

Look for `isPrivate: true, isDefault: true` to spot the user's private pod.

## Runtime behavior

A pod is durable: it pauses when idle and resumes on demand — not ephemeral. Attaching anything to the pod (a project, a vault, a member) propagates to the running sandbox without a restart. Sessions can open against the pod once its sandbox is `ready`.

## Sandbox readiness — check before handing off a session

Session creation fails with *"Pod has no live sandbox"* if the sandbox is paused or absent. Always check first.

```
ren pods sandboxes status <pod-id> --output json
```

Response is a discriminated union on `status`:

- `ready` → live, proceed.
- `provisioning` → in flight; poll again without yielding to the user.
- `absent` → kick off provisioning, then poll to `ready`:
  ```
  ren pods sandboxes provision <pod-id> --output json
  ```
  `provision` is **idempotent** and **resumes a paused sandbox** rather than building a fresh one.
- `failed` → the response carries `reason`. Surface it plainly and stop; don't retry on autopilot.

## Build via CLI

```
ren pods list --scope user --output json    # private pod
ren pods list             --output json    # org pods
ren pods get <pod-id> --output json
ren pods sandboxes status    <pod-id> --output json
ren pods sandboxes provision <pod-id> --output json
ren pods members add <pod-id> --user-id usr_… --role member   # role: owner|member (default member)
ren pods vaults  add <pod-id> --vault-id vlt_… --priority 0   # lower priority wins on name conflict
# also: members list / remove, vaults list / remove
```

## Build via MCP

`{ path, query, body }` envelope:

```
mcp__ren__pod_list             { "query": { "scope": "user" } }     # omit query for org pods
mcp__ren__pod_sandbox_status   { "path": { "podId": "pod_…" } }
mcp__ren__pod_sandbox_provision{ "path": { "podId": "pod_…" } }
mcp__ren__pod_member_add       { "path": { "id": "pod_…" }, "body": { "userId": "usr_…", "role": "member" } }
mcp__ren__pod_vault_add        { "path": { "id": "pod_…" }, "body": { "vaultId": "vlt_…", "priority": 0 } }
```

The `path` key is `id` for member/vault attach, **`podId`** for sandbox endpoints - mirrors the URL.

## Gotchas

- Members are **pod-scoped, not project-scoped**. Use separate projects for different outcomes inside one team; separate pods for different member sets.
- A paused pod is **not** a dead pod. Always try `provision` before declaring the pod down.
- Vault attach priority matters: lower number wins on credential-name conflicts across attached vaults.

## Next steps

A pod by itself does nothing — you need a project inside it.

- **Create a project** in the pod and attach a primary agent. See [[project-dev]].
- **Share credentials across this pod's projects** by attaching a vault. See [[vaults-credentials-dev]].
- **Add teammates** with `ren pods members add` if this is a shared pod.
