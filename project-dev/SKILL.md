---
name: project-dev
description: Create, configure, and manage projects within a pod — including attaching and removing agents. Use when the user wants to set up a project, add or change agents in a project, or configure project settings.
---

# Project Dev

A project lives inside a pod and groups agents together. Agents are attached as `primary` or `subagent`.

## Find the pod first

```
ren pods list
```

Returns the pod list with the current pod marked. You'll need a `podId` to create a project.

## Create a project

```
ren projects create --pod-id pod_… --name "My Project" --description "What this project is for"
```

For nested fields (e.g. `gitRepos`, `permission`) that aren't surfaced as scalar flags, pass them through `--body`:

```
ren projects create --pod-id pod_… --name "My Project" --body '{
  "gitRepos":   [{"url":"…","mountPath":"/repo"}],
  "permission": { … }
}'
```

Returns the new `projectId`.

## Update metadata

```
ren projects update prj_… --name "Renamed Project"
```

Use `--body` for nested fields the same way as on `create`.

## Attach / detach agents

Agents are managed per-attachment — there is no atomic "set the agent list" call.

```
ren projects agents list   prj_…
ren projects agents add    prj_… --agent-id agt_primary  --type primary
ren projects agents add    prj_… --agent-id agt_helper   --type subagent
ren projects agents remove prj_… agt_helper
```

Default `--type` is `subagent`. Every project should have at least one `primary` agent for the platform to route to. Discover agent ids via `ren agents search` or `ren agents get`.

## Read / list

```
ren projects get  prj_…
ren projects list --pod-id pod_…
```

`projects get` returns the project plus its attached agents.
