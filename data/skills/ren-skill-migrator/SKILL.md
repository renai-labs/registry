---
name: ren-skill-migrator
description: >-
  Copy an existing community skill (local folder or git URL) into a new
  destination folder and apply only the edits needed to pass the ren registry
  spec — rewrites SKILL.md frontmatter to the agentskills.io shape, strips
  credential / MCP / file / memory setup steps, and generalizes
  assistant-specific identity references. A dumb copy plus compatibility fixes;
  it does not author, optimize, or publish. Use when the user wants to adopt a
  third-party SKILL.md as a ren skill without rewriting it.
---

# Skill Migration

Copy a community skill package from a **source** path into a **destination** folder, then edit the copy in place so it passes the ren registry spec. **Migration only — a dumb copy plus compatibility fixes.** Preserve the source's wording, examples, headings, and structure; touch only what conflicts with ren's runtime model or fails the frontmatter schema.

This skill does **not** publish and does **not** author from scratch — for `ren skills create`, version bumps, and authoring guidance see [[ren-skill-dev]]. Stay in scope: copy + compatibility, nothing else.

## Args

- **source** — absolute path to the source skill folder, or a git URL (with optional subpath).
- **destination** — absolute path to the new folder to create. Its basename becomes the skill `slug`, and the frontmatter `name` must equal it (see step 1).

If either is missing, ask for it with the runtime's user-input tool. Don't ask anything else unless the source leaves the target genuinely ambiguous.

## 0. Copy source → destination

Never edit the source in place — operate only on the copy.

- **Local folder.** Copy the whole folder verbatim to `destination` (`cp -R <source>/. <destination>/`). Preserve `scripts/`, `references/`, `templates/`, and any other bundled files unchanged.
- **Git URL.** Clone to a tmp dir (`git clone <url> /tmp/skill-migration`), check out the requested ref/subpath, then copy that subtree to `destination`. You'll read the clone's git history for attribution in step 8.

All edits below apply to the files now under `destination`.

## The spec you must satisfy

ren validates SKILL.md frontmatter against this shape when you create the skill. Top level is **strict** — only these keys are allowed:

| Key             | Rule                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------- |
| `name`          | **required.** kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤64 chars, **must equal the destination folder name.** |
| `description`   | **required.** 1–1024 chars.                                                                    |
| `license`       | optional string (SPDX id).                                                                     |
| `compatibility` | optional string, ≤500 chars.                                                                   |
| `allowed-tools` | optional string.                                                                               |
| `metadata`      | optional open map. Ren extras live here: `author`, `source`, `homepage`, `icon`, `docUrl`, `tags` (kebab Slugs), `requiredCredentials`. |

Any other top-level key (notably `version`) fails validation. ren assigns and tracks the version when you create or publish the skill — never put `version` in frontmatter, and don't relocate it to `metadata.version` either (ren's version is authoritative).

## Migration checklist

Walk SKILL.md top-to-bottom, then the bundled folder. Edit minimum surface — delete or substitute exactly what's required, leave surrounding sentences intact.

### 1. Frontmatter → the spec shape

Rewrite the frontmatter to the table above:

- Set `name` to the destination folder's basename, kebab-cased. **Do not rewrite the `description` text** even if it reads weak — keep it verbatim; only truncate if it exceeds 1024 chars, and ask the user how to shorten rather than editing silently.
- Keep `license`, `compatibility`, `allowed-tools` at top level if the source has them.
- **Move** ren extras under `metadata` instead of discarding them: `author`, `source`/`upstream` URL, `homepage`, `icon`, `tags`. Coerce `tags` to kebab Slugs; drop any that can't be. Capture author/source here rather than losing attribution (step 8).
- **Delete** `version` outright — do **not** move it to `metadata.version`; ren owns versioning. For any other top-level key the spec rejects: if it carries real metadata, nest it under `metadata` (it's an open map); otherwise drop it.

### 2. Credentials → `metadata.requiredCredentials`

Find prose that wires a secret: `export FOO_API_KEY=…`, "add to `.env`", "set `process.env.X`", "paste your API key in `config.json`", `${env:OPENAI_API_KEY}`-style references in code blocks.

For each secret:

- Capture the env-var name, normalized to UPPER_SNAKE_CASE matching `^[A-Z_][A-Z0-9_]*$`.
- Capture a one-line description from the source's own wording.
- Add it to `metadata.requiredCredentials` in the frontmatter:
  ```yaml
  metadata:
    requiredCredentials:
      - name: GITHUB_TOKEN
        description: GitHub personal access token used by the gh CLI calls in this skill.
  ```
- **Delete the setup prose only** — leave the rest of the section's instructions alone. At the deletion point insert one short line: `_Credentials are resolved from the pod's vault stack — see [[ren-vaults-credentials-dev]]._`

Never write credential-setup steps back into SKILL.md. The platform injects the env var; if it's missing the skill simply fails at the call site. An empty/absent list is fine — declare only what the body references.

### 3. MCP server references

Find install/run instructions for MCP servers: `npx -y @some/mcp …`, `uvx some-mcp-server`, `mcpServers` JSON blocks (Claude Code / Cursor style), stdio command configs, "add this to your `.mcp.json`".

Replace each install block with one line — don't try to resolve registry ids here (that's authoring, see [[ren-mcp-dev]]):

> _This skill expects the `<name>` MCP to be attached to the agent. See [[ren-mcp-dev]]._

Leave surrounding usage text (how the agent calls the MCP's tools, expected payloads) untouched.

### 4. File-store hints

If the source tells the agent to fetch read-only context the user supplies — "download dataset.csv first", "wget the corpus", "place your PDFs in `./input/`" — flag the spot:

> _In ren, attach these as a file store to the project (read-only mount) — see [[ren-file-memory-store-dev]]._

Do **not** auto-move files. Bundled `references/` / `templates/` markdown already ship with the skill — leave them as-is.

### 5. Memory-store hints

If the source uses local files / sqlite / "remember.json" / a `state/` folder for persistence across runs, flag the spot:

> _In ren, this belongs in a memory store (read-write, persists across runs) — see [[ren-file-memory-store-dev]]._

Don't rewrite the surrounding workflow.

### 6. Bundled resource layout

Leave `scripts/`, `references/`, `templates/` as-is. Other folders (`docs/`, `examples/`, `data/`) still ship fine — do not rename unless ren rejects them. Delete only platform config dirs (step 7).

### 7. Strip assistant / platform identity

ren agents are user-defined. Remove or generalize any mention of a specific assistant or runtime:

| Found                                                  | Substitute with                                |
| ------------------------------------------------------ | ---------------------------------------------- |
| Claude / Claude Code / Anthropic's Claude              | the agent                                      |
| Cursor / Copilot / Codex / OpenCode / Cowork / Hermes  | the agent                                      |
| ChatGPT / GPT-4 / OpenAI's GPT (as runtime context)    | the agent                                      |
| "Claude will read the file…"                           | "the agent reads the file…"                    |
| "Ask Claude to…"                                       | "ask the agent to…"                            |
| Claude-Code-proper-noun tools (Read, Edit, Bash, Glob) | generic capability ("read", "edit", "run")     |
| "Add this to your Claude Code settings / `.mcp.json`"  | _delete entirely_ — handled by ren primitives  |
| "Install in Cursor / VS Code extension"                | _delete entirely_                              |

Minimal-surface substitution: change only the noun, not the surrounding sentence. If a whole paragraph is platform-only setup, delete the paragraph. If the source ships a `.mcp.json` / `.cursor/` / `.claude/` directory, delete those files — ren attaches MCPs through agent definitions, not file-based config.

### 8. Attribution

Capture provenance so it isn't lost in the copy. Walk the chain back to the earliest known author, inspecting in order:

1. Existing `ATTRIBUTION.md` / `CREDITS.md` / `AUTHORS` in the source folder.
2. `LICENSE` headers.
3. Frontmatter fields you moved in step 1 (`author`, `upstream`, `source`, nested origin blocks).
4. The source repo's README / commit history (`git log --reverse --format="%an <%ae>"` if cloned).

Record the earliest named author and immediate source in `metadata`:

```yaml
metadata:
  author: <earliest named author>
  source: <immediate source URL or path>
```

If the source already had an `ATTRIBUTION.md`, the copy carries it forward verbatim (step 0) — **never overwrite it**; append a short section instead:

```markdown
## Migrated to ren

Migrated from <source URL or path> on <YYYY-MM-DD>.
```

If the original author truly can't be determined, leave `metadata.author` out and note it in the summary.

## Before / after (the minimum-surface edits)

| Source pattern                                                                                | Migrated pattern                                                                          |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Set GITHUB_TOKEN in your .env: \`export GITHUB_TOKEN=ghp_…\``                                 | _(delete that line)_ + add `GITHUB_TOKEN` to `metadata.requiredCredentials` + insert vault hint line. |
| `\`\`\`json {"mcpServers": {"linear": {"command":"npx","args":["-y","@linear/mcp"]}}} \`\`\`` | _This skill expects the `linear` MCP to be attached to the agent. See [[ren-mcp-dev]]._    |
| "First, `wget https://example.com/corpus.csv` into `./data/`."                                | "First, the agent reads `corpus.csv` from the attached file store. See [[ren-file-memory-store-dev]]." |
| "Claude will then summarize each row."                                                        | "The agent then summarizes each row."                                                     |
| "Save progress to `./state.json` so you can resume later."                                    | "Persist progress to the attached memory store. See [[ren-file-memory-store-dev]]."       |
| Frontmatter: `version: 1.2.0` / `author: Jane Doe` / `tags: [github, ci]`                     | Drop `version` (don't relocate it). Move `author` + `tags` under `metadata`.              |

## Hard rules — do not

- Do not edit the source — only the copy under `destination`.
- Do not rewrite the `description` for clarity, punchiness, or triggering.
- Do not shorten the body, reformat headings, reflow prose, or reorder sections. Length is not a migration concern.
- Do not delete examples, code blocks, or `scripts/` contents.
- Do not merge, split, or rename files outside step 6 / step 8.
- Do not author or optimize — that's [[ren-skill-dev]]. Do not publish — the user runs `ren skills create` themselves.

## Verify

Confirm the copy passes the spec before reporting done:

- `name` equals the destination folder basename and is kebab-case ≤64 chars.
- `description` is 1–1024 chars.
- No top-level key outside { `name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata` } — especially no `version`.
- `metadata.tags` (if any) are kebab Slugs; `metadata.requiredCredentials[].name` match `^[A-Z_][A-Z0-9_]*$`.

ren validates frontmatter when you create the skill; if you're working inside the ren registry repo, run `bun run validate` to confirm early.

## Output

When done, print a summary of:

1. Destination path of the migrated copy.
2. `metadata.requiredCredentials` — the credentials declared.
3. MCPs the migrated skill expects attached.
4. File-store / memory-store hints — places the user may want to provision a store.
5. Identity substitutions made (counts, optionally a sample diff).
6. Attribution origin recorded.

Then point the user at [[ren-skill-dev]] to author/optimize further or to publish with `ren skills create`.
