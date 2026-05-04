---
name: routine-dev
description: Create, configure, and manage routines (cron-scheduled jobs that send a prompt to an agent). Use when the user wants to automate something on a schedule or manage existing routines.
---

# Routine Dev

A routine sends a prompt to an agent on a cron schedule. It lives inside a pod + project, and the target agent must already be attached to that project.

## Create or update

```
ren_routine_save {
  pod:     "my-pod",
  project: "my-project",
  name:    "daily-report",
  owner:   "user",
  agent:   "my-agent",          // required on create; must be attached to the project
  prompt:  "Generate the report…",
  triggers: [
    { kind: "cron", schedule: "0 9 * * 1-5", timezone: "America/New_York", isEnabled: true }
  ]
}
```

`triggers` replaces the full trigger set — omit to leave unchanged. Only `kind: "cron"` is supported.

## Read / list

```
ren_routine_get  { pod, project, name }    // fetch routine + triggers + recent runs
ren_routine_list { pod, project? }         // list routines in a pod
```

## Run and control

```
ren_routine_run     { pod, project, name }
ren_routine_control { pod, project, name, action: "pause" | "resume" | "archive" }
ren_routine_control { pod, project, name, action: "cancelRun", runId }
```

## Notes

- Always ask the user for their preferred timezone — never assume or default.
- Agent must be attached to the project before creating a routine — use `ren_project_save` first if needed.
- Test with `ren_routine_run` before relying on the schedule.
