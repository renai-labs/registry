---
name: debug-run
description: Diagnose a failed or suspicious agent session/routine run, identify the root cause, apply a targeted fix, and verify it. Use when asked to debug a run, investigate why a routine failed, review a past session, or improve an agent based on a real trace.
---

# debug-run

Walk a real run, find the root cause, fix it at the right layer, verify.

## 1. Locate the run

If the user gave a `runId` + `routineId`, skip to step 2.

Otherwise list recent runs and pick one:

```
ren_routine_runs_list(pod, status="failed", limit=20)
```

Narrow with `project`, `routineId`, `createdAfter`, or `sessionId` if the user mentioned them. Confirm the chosen run with the user before going further.

## 2. Read the trace

```
ren_routine_run_get(pod, routineId, runId, tail=200)
```

This returns the run + its session messages in one call. If `session` is `null`, the run never started — check `run.error` and stop here; the fix is at the trigger or routine config layer, not in agent behavior.

For long sessions, page with `ren_session_messages(pod, sessionId, limit, offset)` instead of pulling everything.

## 3. Diagnose

Scan the messages for one of these signals and map to a layer:

| Signal in messages | Likely layer |
|---|---|
| Tool call errors, missing/hallucinated args | **skill** (instructions unclear) or **agent** (no lookup-before-action discipline) |
| Same tool called 3+ times with same args, no progress | **agent** (no exit conditions) |
| Skipped expected steps; never called a tool that was attached | **agent** (deps not surfaced) or **project** (agent not attached) |
| Used wrong-but-similar tool | **agent** (no tool-selection guidance) |
| Generic / off-topic final output | **routine** prompt too vague, or **agent** missing output format |
| High token use with poor output | **agent** prompt bloated or looping |
| Run never produced a session | **routine** config (status, projectAgentId) or trigger |

See `references/diagnosis-patterns.md` for fuller pattern descriptions.

State the diagnosis explicitly before fixing: *"Root cause is X at the {routine|agent|skill|project} layer because [evidence: message ids / tool names / error strings]."*

## 4. Fix at the right layer

Pick **one** layer — the smallest scope that addresses the root cause. Don't fan out fixes.

- **Routine prompt / status / agent binding** → `ren_routine_save` (pass only the fields you're changing; triggers and other fields carry over).
- **Agent prompt / model / skill+mcp deps** → `ren_agent_save` (full dep list replaces existing — pass `skills`/`mcps` only if you're changing them).
- **Skill content** → `ren_skill_save` from the local skill folder (creates a new version).
- **Agent not attached to the project** → `ren_project_save` with the `agents` list.

If you're modifying an agent or skill, follow `agent-creator` / `skill-creator` for content guidance. Read the current state first (`ren_agent_get` / `ren_skill_get`) so you're editing, not rewriting.

## 5. Verify

Fire the routine manually and read the new run:

```
ren_routine_run(pod, routineId)              # returns RoutineRun; note runId
ren_routine_run_get(pod, routineId, runId)   # may need a second call once it starts
```

Confirm the failure signal from step 3 is gone. If the new run shows the same pattern, the diagnosis was wrong — return to step 3 with the new trace as additional evidence; do not stack a second fix on top.

Report: the run you debugged, the root-cause layer, what changed, and the new run's outcome.

## Quick reference

| Action | Tool |
|---|---|
| Find runs | `ren_routine_runs_list` |
| Read run + messages | `ren_routine_run_get` |
| Page session messages | `ren_session_messages` |
| Read session metadata | `ren_session_get` |
| Read agent / skill | `ren_agent_get` / `ren_skill_get` |
| Fix routine | `ren_routine_save` |
| Fix agent | `ren_agent_save` |
| Fix skill | `ren_skill_save` |
| Attach agent to project | `ren_project_save` |
| Re-run for verification | `ren_routine_run` |
