---
name: project-dev
description: Create, configure, and manage projects within a pod — including attaching and removing agents. Use when the user wants to set up a project, add or change agents in a project, or configure project settings.
---

# Project Dev

A project lives inside a pod and groups agents together. Agents are attached as primary or subagent roles.

## Create or update

```
ren_project_save {
  pod:   "my-pod",
  slug:  "my-project",
  owner: "user",
  name:  "My Project",          // required on first create
  agents: [
    { slug: "my-agent",    owner: "user",     type: "primary"  },
    { slug: "sub-agent",   owner: "registry", type: "subagent" }
  ]
}
```

`agents` replaces the full attachment list — omit to leave existing agents unchanged.

Optional fields: `description`, `gitRepos` (`[{ url, mountPath }]`), `permission`.

## Read / list

```
ren_project_get  { pod, project }    // fetch project + attached agents
ren_project_list { pod }             // list all projects in a pod
```

## Notes

- Every project needs at least one `primary` agent.
- Attach agents to a project before creating routines that target them.
