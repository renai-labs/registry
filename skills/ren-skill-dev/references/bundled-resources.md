# Bundled Resources

A skill can ship `scripts/`, `references/`, and `assets/` alongside SKILL.md. Use them to keep the body focused while extending what the skill can do.

## Decision matrix

| Type           | Loaded into context?         | Use for                                                          | Example                            |
| -------------- | ---------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| `scripts/`     | No (executed)                | Deterministic operations the agent runs repeatedly               | `validate.ts`, `deploy.sh`         |
| `references/`  | Only when explicitly read    | Schemas, long docs, domain depth                                 | `bigquery-tables.md`, `api-spec.md`|
| `assets/`      | No                           | Static resources — templates, images, data files (lookup tables) | `letter.html`, `logo.svg`          |

## scripts/

For tasks where the *what* is fixed and the *how* shouldn't drift across runs.

**Runtime:** limited to what the sandbox image ships — **Bash/shell, Node.js, or Bun (TypeScript/JS)**. There is **no Python** runtime (nor Ruby, Deno, Go) — a `.py` script won't execute. Pick one per script.

**Don't bundle when a tool already does the job.** Reference it from SKILL.md and pin the version: `bunx prettier@3.3.3 --write .` (`npx pkg@ver` also works). Promote to a tested `scripts/` file once a command is hard to get right or the agent keeps reinventing the same logic.

### Designing scripts for agentic use

The agent reads stdout/stderr and exit codes to decide what to do next:

- **No interactive prompts** — the shell is non-interactive, so a script that blocks on input hangs. Take input via flags/env/stdin; on a missing flag, error with usage instead of prompting.
- **`--help`** documents the interface — brief, since it enters context.
- **Helpful errors** — what went wrong, what was expected, what to try: `--format must be one of json|csv|table; got "xml"`.
- **Structured output to stdout, diagnostics to stderr** — JSON/TSV the agent and `jq` can parse; progress/warnings to stderr.
- **Idempotent, safe defaults** — agents retry; gate destructive ops behind `--dry-run`/`--confirm`.
- **Meaningful exit codes** (documented in `--help`) and **predictable output size** — harnesses truncate past ~10–30K chars, so summarize or support `--output FILE`.

### Tests

Tests live in `scripts/tests/` — red/green/refactor TDD for non-trivial scripts, fast (<1s), mock external deps. Document constants at the top. Reference scripts from SKILL.md by relative path: `bun scripts/validate.ts <arg>`.

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

## assets/

For static resources that show up in output or feed a workflow but don't need to be loaded as text.

- Templates — document templates, config templates, sample docs for fill-in-the-blanks workflows.
- Brand assets (logos, fonts, color tokens).
- Boilerplate code (project starters).
- Data files (lookup tables, schemas, fixtures).

The agent reads an asset only when it needs to copy or adapt it, not on every trigger.

## Avoiding duplication

A fact lives in *one* place: SKILL.md, a reference, or a script comment — never two. If you find yourself repeating, pick one home and link to it from the others.

## When to NOT bundle

- If a fact fits in 2 lines, inline it in SKILL.md.
- If a script is 5 lines of trivial bash, inline it as a code block.
- If a reference would be < 30 lines and only used once, inline it.

The point of bundled resources is keeping core SKILL.md context-cheap. Don't bundle for the sake of it.
