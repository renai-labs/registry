# Bundled Resources

A skill can ship `scripts/`, `references/`, and `templates/` alongside SKILL.md. Use them to keep the body focused while extending what the skill can do.

## Decision matrix

| Type           | Loaded into context?         | Use for                                                     | Example                            |
| -------------- | ---------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| `scripts/`     | No (executed)                | Deterministic operations the agent runs repeatedly          | `validate.py`, `deploy.sh`         |
| `references/`  | Only when explicitly read    | Schemas, long docs, domain depth                            | `bigquery-tables.md`, `api-spec.md`|
| `templates/`   | No                           | Boilerplate output assets — logos, fonts, starter HTML/code | `letter.html`, `logo.svg`          |

## scripts/

For tasks where the *what* is fixed and the *how* shouldn't drift across runs.

- Any language: Python, Bash, Node.js, etc. Pick one per script.
- Tests live in `scripts/tests/`. Use red/green/refactor TDD for non-trivial scripts.
- Handle errors explicitly. Prefer JSON output to plain text.
- Document constants at the top.
- Keep tests fast (< 1s each). Mock external dependencies.

Reference scripts from SKILL.md by relative path, e.g. `scripts/validate.py <skill-name>`.

## references/

For depth that doesn't need to be in context every time the skill triggers.

- Add a short table of contents at the top of any reference file > 100 lines.
- One level only — link from SKILL.md to a reference; don't chain reference → reference.
- Split by domain or workflow, not by chronology.
- Mention each reference in SKILL.md with a one-line description so the agent knows when to read it.

Example structure:

```
bigquery-skill/
├── SKILL.md
└── references/
    ├── finance.md     # finance-specific tables and queries
    ├── sales.md
    └── product.md
```

## templates/

For assets that show up in output but don't need to be loaded as text.

- Brand assets (logos, fonts, color tokens).
- Boilerplate code (project starters, config templates).
- Sample documents for fill-in-the-blanks workflows.

The agent reads templates only when it needs to copy or adapt them, not on every trigger.

## Avoiding duplication

A fact lives in *one* place: SKILL.md, a reference, or a script comment — never two. If you find yourself repeating, pick one home and link to it from the others.

## When to NOT bundle

- If a fact fits in 2 lines, inline it in SKILL.md.
- If a script is 5 lines of trivial bash, inline it as a code block.
- If a reference would be < 30 lines and only used once, inline it.

The point of bundled resources is keeping core SKILL.md context-cheap. Don't bundle for the sake of it.
