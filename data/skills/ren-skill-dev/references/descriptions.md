# Writing Descriptions

The `description` carries the entire burden of triggering: an agent loads only `name` +
`description` up front and reads the body on demand when a task matches. Get it wrong and the
skill never loads. (Note: agents skip skills for trivial tasks they can already do — a
description earns its keep on specialized work: unfamiliar APIs, domain workflows, uncommon
formats.)

## Principles

- **Imperative phrasing.** "Use when the user wants to…", not "This skill does…".
- **User intent, not mechanics.** Match what the user asked for, not internals.
- **Err pushy.** List the contexts it applies to, including ones where the user won't name
  the domain: "…even if they don't explicitly say 'CSV' or 'analysis.'"
- **Cover both halves** — *what it does* AND *when to trigger*. Weak descriptions omit the trigger.
- **Concise.** A few sentences; ≤1024 chars (Ren frontmatter rejects longer).

## Before / after

```yaml
# Before — only says "what", triggers on almost nothing
description: Process spreadsheets.

# After — what it does + when to reach for it, pushy about implicit cases
description: >
  Analyze and transform tabular data — summary statistics, derived columns,
  cleaning, charts. Use when the user has a CSV, TSV, or spreadsheet and wants
  to explore, reshape, or visualize it, even if they don't say "CSV" or "analysis."
```

More *specific* about what it does, *broader* about when it applies.

## Sanity-check

Jot a few prompts it *should* fire on (vary phrasing/explicitness) and a few near-misses it
*shouldn't*. If a should-fire reads like it wouldn't match, it's too narrow; if a near-miss
would match, it's too broad — fix the boundary, don't bolt on keywords.
