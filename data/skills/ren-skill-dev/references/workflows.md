# Workflow & Instruction Patterns

Reusable techniques for structuring a skill's instructions. Not every skill needs all of
them — reach for the ones that fit the task.

## Sequential Workflows

For complex tasks, break operations into clear, sequential steps. It is often helpful to give Ren an overview of the process towards the beginning of SKILL.md:

```markdown
Filling a PDF form involves these steps:

1. Analyze the form (run analyze_form.ts)
2. Create field mapping (edit fields.json)
3. Validate mapping (run validate_fields.ts)
4. Fill the form (run fill_form.ts)
5. Verify output (run verify_output.ts)
```

## Conditional Workflows

For tasks with branching logic, guide Ren through decision points:

```markdown
1. Determine the modification type:
   **Creating new content?** -> Follow "Creation workflow" below
   **Editing existing content?** -> Follow "Editing workflow" below

2. Creation workflow: [steps]
3. Editing workflow: [steps]
```

## Gotchas

Often the highest-value content: environment-specific facts that defy assumptions — concrete corrections to mistakes the agent _will_ make otherwise, not general advice. Keep them in **SKILL.md itself** (the agent must read them before hitting the situation), and grow the section every time you correct a real mistake.

```markdown
## Gotchas

- The `users` table uses soft deletes — queries need `WHERE deleted_at IS NULL`.
- The same value is `user_id` in the DB, `uid` in auth, `accountId` in billing.
- `/health` returns 200 whenever the web server is up, even if the DB is down — use `/ready`.
```

## Validation loops

Have the agent check its own work: do the work → run a validator (script, checklist, or self-check) → fix → repeat until it passes. For batch/destructive ops, extend this to **plan-validate-execute** — emit a structured plan, validate it against a source of truth, then execute:

```markdown
1. Extract fields: `bun scripts/analyze_form.ts input.pdf` → form_fields.json
2. Create field_values.json mapping each field to its value
3. Validate: `bun scripts/validate_fields.ts form_fields.json field_values.json`
4. If it fails, revise field_values.json and re-validate; only then fill the form
```

The validator in step 3 is the key — a precise error ("Field 'signature_date' not found — available: customer_name, order_total") lets the agent self-correct.
