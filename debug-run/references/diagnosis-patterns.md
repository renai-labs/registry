# Diagnosis patterns

Common failure shapes seen in routine-run sessions. Use after `ren_routine_run_get` to map message evidence to a fix layer.

## Tool-call loop

**Evidence:** Same tool called 3+ times in a row with identical or near-identical args, no progress between calls.
**Layer:** Agent.
**Fix:** Add explicit exit conditions to the agent prompt — what counts as success, when to stop retrying, how to handle empty/unexpected results.

## Missing or hallucinated args

**Evidence:** Tool errors with "missing required argument" or the agent passes an ID that was never returned by a prior call.
**Layer:** Skill (instructions don't list required args / lookup steps) or agent (no lookup-before-action habit).
**Fix:** Update the skill's SKILL.md to require the lookup tool first ("Never assume an ID — call `list_X` first"). Or tighten the agent prompt with the same rule.

## Generic / off-topic output

**Evidence:** Final assistant message is vague, template-like, or doesn't address the routine's prompt.
**Layer:** Routine prompt (too vague) or agent (no output-format guidance).
**Fix routine:** Rewrite the routine prompt with concrete output expectations and an example.
**Fix agent:** Add output-format instructions to the agent prompt.

## Agent ignores attached skill

**Evidence:** Agent has a skill attached but doesn't follow its steps, or never invokes its tools.
**Layer:** Agent (prompt overrides skill) or project (skill not actually attached to the agent's deps).
**Fix:** Confirm via `ren_agent_get` that the skill is in the dep list. Remove conflicting instructions from the agent prompt, or add the skill via `ren_agent_save`.

## High token cost, low quality

**Evidence:** Many large messages, repeated context, output still poor.
**Layer:** Agent.
**Fix:** Shorten the agent prompt. Add stopping conditions. If the agent uses retrieval, instruct it to fetch only what's needed.

## Wrong-but-similar tool

**Evidence:** Agent used a tool semantically near the right one but returning different data (e.g. listed sessions instead of reading messages).
**Layer:** Agent or skill.
**Fix:** Add explicit tool-selection guidance: "To get X, use `tool_a`, not `tool_b`."

## Run never produced a session

**Evidence:** `ren_routine_run_get` returns `session: null` and a non-null `run.error`, or the run sits `pending` forever.
**Layer:** Routine config or trigger.
**Fix:** Check `routine.status` (paused?), `projectAgentId` (still valid?), and the cron trigger's `isEnabled`/`schedule`. Re-save with `ren_routine_save`.
