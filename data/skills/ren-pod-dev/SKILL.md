---
name: ren-pod-dev
description: >-
  Inspect and manage pods - the durable sandbox boundary that runs agents. Use
  when the user wants to find a pod, check or wake its sandbox, add members, or
  attach vaults. Read this before any build, to know where the work will live.
---

# Pod Dev

A pod is one durable sandbox plus a member set of users and agents. Agents run inside this sandbox; everything attached to the pod (skills, MCPs, stores, vaults) is available to every project in it. A pod is the unit of isolation: different member sets or credential boundaries → different pods.

> Commands and flags (`pods list / get / sandboxes status / sandboxes provision / members add / vaults add`): `ren docs commands`. Runtime model (durable, pauses when idle, propagation without restart) and scope: `ren docs model`. This skill is how to arrange pods and the sandbox-readiness choreography.

## How to arrange pods

One **private pod per user** for personal work. **Team pods are shaped around shared work, not necessarily the org chart** - a sales team, an emergency warroom, a per-customer pod, a prod-vs-staging credential split. The axes are orthogonal; ask the user "who else needs to see this?" before creating.

A new org automatically gets both a private pod (yours) **and** a general org pod; older accounts may have only the org pod. List with **both** scopes if you don't know where the user wants to build — `ren pods list --scope user` (private) and `ren pods list` (org). Look for `isPrivate: true, isDefault: true` to spot the user's private pod.

## Scope

Your **private pod** lives in your user namespace; every pod command targeting it needs `--scope user` (`ren docs model`).

## Sandbox readiness — check before handing off a session

Session creation fails with *"Pod has no live sandbox"* if the sandbox is paused or absent. Always check first with `ren pods sandboxes status <pod-id> --scope user --output json`. The response is a discriminated union on `status`:

- `ready` → live, proceed.
- `provisioning` → in flight; poll again without yielding to the user.
- `absent` → kick off `ren pods sandboxes provision <pod-id> --scope user`, then poll to `ready`. `provision` is **idempotent** and **resumes a paused sandbox** rather than building a fresh one.
- `failed` → the response carries `reason`. Surface it plainly and stop; don't retry on autopilot.

A `ready` status also returns `serverPassword` — the HTTP-basic password (username `opencode`) for the sandbox's raw OpenCode URL, if you ever need it.

## Gotchas

- Members are **pod-scoped, not project-scoped**. Use separate projects for different outcomes inside one team; separate pods for different member sets.
- Vault attach priority matters: lower number wins on credential-name conflicts across attached vaults.

## Next steps

A pod by itself does nothing — you need a project inside it.

- **Create a project** in the pod and attach a primary agent. See [[ren-project-dev]].
- **Share credentials across this pod's projects** by attaching a vault. See [[ren-vaults-credentials-dev]].
- **Add teammates** with `ren pods members add` if this is a shared pod.
