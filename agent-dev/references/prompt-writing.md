# Prompt Writing

Most behaviour issues trace back to a vague prompt — not missing tools.

## Four traits

1. **Specific.** States what the agent does, not what it could do.
2. **Actionable.** Concrete steps or rules, not abstract goals.
3. **Scoped.** Says what's *out* of scope to prevent spillover.
4. **Tool-aware.** Says *when* to reach for each tool — don't restate what the tool description already says.

## Skeleton

```
You are <role>. Your job is <single primary responsibility>.

## Workflow
1. <step>
2. <step>

## Output
<format, structure, fields>

## Rules
- <always do>
- <never do>
- <how to handle ambiguity>
```

## Push depth into skills

If your prompt has a multi-line "how to do X" section, that's a skill. The prompt should gesture at the workflow; the skill carries the detail.

## Avoid

- Personality fluff ("helpful, polite, friendly") — useless tokens.
- Tool restatement — don't paraphrase what the tool description says.
- Defensive padding ("always be careful") — vague and unfalsifiable.

## Iterate

Revise *after* you've seen a real failure, not before. Identify the wrong call, add one specific rule to prevent it, `ren_agent_save` with a patch bump.
