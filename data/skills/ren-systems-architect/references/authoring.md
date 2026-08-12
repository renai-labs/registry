# Authoring

## Contents

- [Skills](#skills)
- [Agents](#agents)
- [Custom MCPs](#custom-mcps)

Reuse first (`references/design-patterns.md` §Reuse). Author only when nothing fits.

```bash
ren skills search --sources user org registry --query "<need>"   # list shows only your own
ren mcps search   --sources user org registry --query "<need>"
ren agents search --sources user org registry --query "<need>"
ren skills pull <id-or-slug> ./local-copy [--version <v>]        # download the files to read or edit
ren skills versions data <skl_…> <version> --format presigned    # raw bundle URLs
ren skills copy <skl_…> --name "my-variant" --visibility private # fork server-side; source untouched
```

Prefer org skills, MCPs and agents over registry entries. If neither has a fit, search the web for an
adaptable `SKILL.md` or an official remote MCP before writing your own.

---

# Skills

A skill is a folder: `SKILL.md` at the root plus optional `scripts/`, `references/`, `assets/`. Only
frontmatter `name` + `description` load up front; the body loads on demand, and bundled files only
when opened. That is what lets an agent carry many skills and pay for none of their content.

## Ground the first version

Base the instructions on a completed task, runbook, schema, trace or working patch. Extract the
repeatable steps, decisions and failures. If no source exists, run one concrete example first. Do not
fill gaps with generic advice.

## Frontmatter

```
---
name: my-skill-name        # kebab-case, ≤64 chars, MUST equal the folder name
description: ...           # 1–1024 chars: what it does AND when to reach for it
---
```

Strict top level — only `name`, `description`, `license`, `compatibility`, `allowed-tools`,
`metadata`. Any other key fails validation, **notably `version`**: Ren owns versioning, and moving it
to `metadata.version` is not a workaround. Ren extras go under `metadata`: `author`, `source`,
`homepage`, `icon`, `docUrl`, `tags` (kebab slugs), `requiredCredentials`.

`skill.slug` is globally unique across all of Ren, so a create can fail on a name another org took.

## Descriptions carry the whole trigger

The body never loads if the description doesn't match. Imperative ("Use when the user wants to…"),
phrased as user intent not mechanics, covering both halves, and pushy about implicit cases:

```yaml
# Before — only says "what", triggers on almost nothing
description: Process spreadsheets.

# After
description: >
  Analyze and transform tabular data — summary statistics, derived columns, cleaning, charts.
  Use when the user has a CSV, TSV, or spreadsheet and wants to explore, reshape, or visualize it,
  even if they don't say "CSV" or "analysis."
```

More specific about what it does, broader about when it applies. Sanity-check by jotting prompts it
should fire on and near-misses it shouldn't; fix the boundary rather than bolting on keywords.

## Writing the body

1. **≤500 lines / ~5,000 tokens.** Move depth into `references/`.
2. **Add what the agent lacks, omit what it knows.** Skip generic background; spend tokens on
   conventions, edge cases, and which tool or API to use.
3. **Match specificity to fragility.** Open tasks get guidance and reasons; fragile sequences get
   exact commands or a script.
4. **Procedures over declarations** — how to approach a class of problem, not one instance's answer.
5. **Defaults, not menus.** One recommended path; alternatives in a clause.
6. **Gotchas live in `SKILL.md`** — concrete corrections to mistakes the agent will otherwise make
   ("`/health` returns 200 whenever the web server is up, even if the DB is down — use `/ready`").
   Grow the section every time you correct a real run.
7. **A fact lives in one place.** Link, don't repeat.

Useful shapes:

- **Sequential workflow** — number the steps and give the overview near the top.
- **Conditional workflow** — name the decision point, then branch ("Creating new content? → …").
- **Validation loop** — do the work → run a validator → fix → repeat. For batch or destructive work,
  plan → validate against a source of truth → execute. The validator's error message is the point:
  `Field 'signature_date' not found — available: customer_name, order_total` lets the agent
  self-correct.
- **Output template** — give the exact structure when the format is strict, or a "sensible default,
  use judgment" version when adaptation helps.
- **Input/output examples** — when quality depends on style (commit messages, summaries), two worked
  pairs teach more than a paragraph of description.

## Bundled resources

| Folder        | Loaded into context | Use for                                          | Example                    |
| ------------- | ------------------- | ------------------------------------------------ | -------------------------- |
| `scripts/`    | no (executed)       | deterministic operations run repeatedly          | `validate.ts`, `deploy.sh` |
| `references/` | only when read      | schemas, domain depth, long procedures           | `api-spec.md`              |
| `assets/`     | no                  | templates, images, lookup data the agent copies  | `letter.html`, `logo.svg`  |

- References: one level deep from `SKILL.md`, each mentioned with **when** to read it ("read
  `references/api-errors.md` if the API returns a non-200"). Add a table of contents above 100 lines.
  Split by domain or workflow, not chronology.
- Don't bundle what a pinned one-liner does (`bunx prettier@3.3.3 --write .`); promote to a script
  once the command is hard to get right. Don't bundle a 2-line fact, a 5-line bash snippet, or a
  30-line single-use reference — inline it.
- Scripts may use Bash, Node, Bun, Python or Go; prefer the runtime already used by the source or the
  simplest fit. Design them for an agent reader: no interactive prompts (the shell is non-interactive
  and a prompt hangs), a brief `--help`, structured output on stdout with diagnostics on stderr,
  errors that state what was expected, documented exit codes, idempotent behaviour with
  `--dry-run`/`--confirm` for destructive work, and predictable output size (harnesses truncate past
  ~10–30K chars). Tests live in `scripts/tests/`.

## requiredCredentials

The list is per version and full-replace. Skills support two requirement kinds:

```yaml
metadata:
  requiredCredentials:
    - kind: env
      name: OPENAI_API_KEY
      description: API key used to call OpenAI.
    - kind: oauth_app
      name: Google Workspace
      description: Organization OAuth app used for Google consent.
```

- `env` names must match `^[A-Z_][A-Z0-9_]*$`. An unresolved name is absent at runtime, so the skill
  still loads and fails when it tries to use the variable.
- `oauth_app` names an organization OAuth app. It is not an environment variable and does not use the
  uppercase-name rule.

Declare only requirements the skill needs. Never write credential setup steps into `SKILL.md`;
assume the requirement is present.

## Adapting a fork or a community skill

Copy the whole folder to a new slug first; a skill *is* its directory. Then migrate the copy —
minimum-surface edits, never the source.

| Found                                                        | Do                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `version:` in frontmatter                                    | delete (don't relocate); move `author`/`source`/`tags` under `metadata`          |
| `export FOO_API_KEY=…`, "add to `.env`", `${env:…}` in code  | add the env name to `metadata.requiredCredentials`, delete the setup prose only  |
| `npx -y @some/mcp`, `mcpServers` JSON, `.mcp.json`           | one line: this skill expects the `<name>` MCP attached to the agent              |
| local input/output paths (`./data/`, `./output/report.md`)   | point at an attached file store, preserving meaningful relative paths            |
| "remember the last processed record"                         | an attached memory store — or a pod database if it is rows to dedupe against     |
| Claude / Cursor / Copilot / Codex / OpenCode as the runtime  | "the agent"; proper-noun tools (Read, Edit, Bash) → generic verbs                |
| editor setup sections, `.claude/`, `.cursor/` directories    | delete                                                                           |

**Hard rules:** never edit the source; never rewrite the `description` for style (only truncate over
1024 chars, and ask first); never shorten, reflow or reorder the body; never delete examples, code
blocks or scripts. Length is not an adaptation concern.

Attribution: walk back to the earliest known author (`ATTRIBUTION.md`, `LICENSE` headers, frontmatter,
repo history) into `metadata.author` / `metadata.source`. Keep an existing `ATTRIBUTION.md` verbatim
and append a short migration note. If the author can't be determined, say so in your summary.

## Create, version, verify

```bash
ren skills create ./my-skill --visibility private
ren skills versions create <skl_…> ./my-skill --version patch --release-notes "…"
```

Git-backed skills **cannot be versioned** — hard reject.

Before reporting done: `name` equals the folder basename and is kebab-case ≤64 chars; `description`
is 1–1024 chars; no stray top-level keys; `metadata.tags` are kebab slugs; `env` credential names
match `^[A-Z_][A-Z0-9_]*$`. Inside this repository, run
`bun run --cwd registry publish:registry -- --dry-run` to validate the bundle without publishing it.

Iterate from real runs: read a session's execution trace, not just its output — wasted steps mean
instructions too vague, inapplicable, or missing a default. Fix the failing step, bump the version,
add the correction as a gotcha. Don't try to anticipate every edge case in v1.

---

# Agents

A prompt + a model + a dependency set. Keep them small and atomic so they compose, stay debuggable,
and version independently. Write one when the work wants its own prompt or model; attach it to the
project (`references/design-patterns.md`).

## Prompt

Role → workflow → output format → rules. Specific (what it does, not what it could), actionable,
scoped (say what is out of scope), tool-aware (say *when* to reach for a tool; don't restate its
description). No personality fluff, no defensive padding.

```
You are <role>. Your job is <single primary responsibility>.

## Workflow
1. <step>

## Output
<format, structure, fields>

## Rules
- <always> / <never> / <how to handle ambiguity>
```

If the prompt grows a multi-line "how to do X" section, that is a skill. Most behaviour problems are
a vague prompt, not a missing tool.

## Model

Don't pick silently. Offer heavy / balanced / light with a one-line trade-off each and current
`$/M in` + `$/M out` — `ren models list --output json`. Sensible defaults: Claude Opus 5 heavy,
Sonnet 5 balanced, Haiku 4.5 light. An agent can also inherit the pod default (`--body
'{"model":null}'`).

## Versions and dependencies

An agent version is an immutable snapshot of prompt, model and dependencies. **One version = one
logical change**, so a regression bisects. Anti-patterns: over-attaching (three focused skills beat
ten loose ones), stale dep lists (the lists are full-replace — `ren agents get` first and pass the
union), and one skill carrying two unrelated workflows.

```bash
ren agents create --body @agent.json --visibility private
ren agents versions create <agt_…> --body @agent.json --release-notes "…"
ren agents get <agt_…>
```

Iterate: verify current state → watch a real run → fix the one failing thing (skill content for a
capability gap, prompt or deps for behaviour) → new version.

---

# Custom MCPs

Last resort in the fallback ladder (`references/composition.md`) — unmaintained surface you now own.
Not every product exposes an MCP server; when the registry has nothing and no official server exists,
the fallback is an API-key-backed skill.

- **It must be a reachable remote HTTP server.** Without `mcpServerUrl` it is dropped at compose time
  and the agent never sees its tools.
- **Defining is not authorizing.** `authConfig` declares only where a secret is presented and carries
  no secret; wiring the credential is separate (`references/credentials.md`).
- `authConfig` is nested → `--body` on `ren mcps create`. Definition edits (URL, `authConfig`)
  propagate on the next manifest refresh; attaching makes tools available in the next session, no
  restart.

The paired credential must use the env-var name Ren derives from the slug (upper-cased,
non-alphanumerics → `_`):

| `auth`    | Env var                   |
| --------- | ------------------------- |
| `api_key` | `MCP_<SLUG>_KEY`          |
| `basic`   | `MCP_<SLUG>_BASIC`        |
| `oauth`   | `MCP_<SLUG>_ACCESS_TOKEN` |

Shapes: `{ type: "api_key", headerName: "Authorization", prefix: "Bearer " }`,
`{ type: "api_key", queryParam: "api_key" }`, `{ type: "basic" }` (raw `user:password`, encoded at
runtime), `{ type: "oauth" }` (Bearer; refresh is server-side).

Validate before attaching:

```bash
scripts/validate-mcp.js https://mcp.acme.com/mcp                  # public server
scripts/validate-mcp.js https://mcp.acme.com/mcp --auth oauth     # protected: discovery only
scripts/validate-mcp.js https://mcp.acme.com/mcp --token "$TOKEN" # list tools through the auth wall
scripts/validate-mcp.js --help                                    # drift checks, --json, all options
```

MCPs are deduped by slug with **no conflict report** — two bindings of the same slug with different
configs, first one silently wins.
