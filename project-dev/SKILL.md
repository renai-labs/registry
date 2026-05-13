---
name: project-dev
description: Create, configure, and manage projects within a pod — including attaching and removing agents. Use when the user wants to set up a project, add or change agents in a project, or configure project settings.
---

# Project Dev

A project lives inside a pod and groups agents together. Agents are attached as `primary` or `subagent`.

## Find the pod first

```
ren_pod_list {}    // returns { currentPodId, pods: [{ id, name, current }] }
```

`podId` defaults to the current pod on every project tool, so you only need to pass it when creating in or reading from a non-current pod.

## Create or update

```
ren_project_upsert {
  podId:       "pod_…",                       // optional; defaults to current pod
  projectId:   "prj_…",                       // omit to create; pass to update
  owner:       "user",                        // "user" (default) or "org"
  name:        "My Project",                  // required when creating
  description: "What this project is for",    // optional
  permission:  { … },                         // optional permission config
  gitRepos:    [{ url: "…", mountPath: "/repo" }],  // full-replace; omit to leave unchanged
  agents: [
    { agentId: "agt_primary",  type: "primary"  },
    { agentId: "agt_helper",   type: "subagent" }    // default type if omitted
  ]
}
```

Identity is by `projectId`. To create, omit `projectId` and pass `name`. `agents` and `gitRepos` are full-replace lists — omit either to leave the existing attachments unchanged.

Default agent `type` is `subagent`. Every project should have at least one `primary` agent for the platform to route to.

## Read / list

```
ren_project_get  { podId?, projectId: "prj_…", owner: "user" }   // fetch project + attached agents
ren_project_list { podId?, owner: "user", limit? }               // list projects in a pod
```

`ren_project_get` returns the project plus `agents: [{ projectAgentId, agentId, agentVersionId, type, slug, name }]`.

## Ownership

`owner` controls the access scope of the call:

- `user` (default) — your personal projects and any org-wide ones you can see.
- `org` — org-wide only.

Pass the wrong scope on an existing `projectId` and the server returns not-found.

## Notes

- Attach agents to a project before creating routines that target them.
- The `agents[].agentId` you pass is just the id — no per-agent owner field. Discover ids via `ren_search { type: "agent" }` or `ren_agent_get`.
