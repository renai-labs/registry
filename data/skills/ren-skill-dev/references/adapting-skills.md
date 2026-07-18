# Adapting an existing skill — fork or community source

The migrate half of forking (the copy half lives in SKILL.md under "Two ways to start"). Adapting a forked registry skill or a third-party / community SKILL.md is **the same task as authoring**: you start from existing prose instead of a blank page. Keep the source's wording, examples, headings, and structure; edit only what conflicts with Ren's runtime model or fails the frontmatter spec. **Operate on the copy, never the source.** Minimum-surface — change the noun, not the surrounding sentence; delete a paragraph only when it's entirely platform setup.

Walk SKILL.md top-to-bottom, then the bundled folder:

1. **Frontmatter → the spec shape (the frontmatter table in SKILL.md).** Set `name` to the folder basename, kebab-cased. **Keep `description` verbatim** even if it reads weak — only truncate if it exceeds 1024 chars, and ask the user how to shorten rather than editing silently. Move ren extras (`author`, `source`/upstream URL, `homepage`, `icon`, `tags`) under `metadata` rather than discarding them; coerce `tags` to kebab slugs, drop any that can't be. **Delete `version`** outright (don't relocate). Nest any other real metadata under `metadata`; drop the rest.
2. **Credential setup prose → `metadata.requiredCredentials`.** Find prose that wires a secret (`export FOO_API_KEY=…`, "add to `.env`", "paste your API key in `config.json`", `${env:OPENAI_API_KEY}` in code blocks). For each: capture the env-var name normalized to `^[A-Z_][A-Z0-9_]*$`, a one-line description from the source's own wording, and add it to `metadata.requiredCredentials`. **Delete the setup prose only** — leave the rest of the section — and insert one line: `_Credentials are resolved from the pod's vault stack — see [[ren-vaults-credentials-dev]]._`
3. **MCP install blocks → one line.** Find `npx -y @some/mcp …`, `uvx some-mcp-server`, `mcpServers` JSON, stdio configs, "add to your `.mcp.json`". Replace each install block with: `_This skill expects the <name> MCP to be attached to the agent. See [[ren-mcp-dev]]._` Leave usage text (how the agent calls the MCP's tools) untouched.
4. **File-store hints.** Where the source tells the agent to fetch user-supplied read-only context ("download dataset.csv first", "wget the corpus", "place your PDFs in `./input/`"), flag it: `_In ren, attach these as a file store to the project (read-only mount) — see [[ren-systems-architect]]._` Do not auto-move files.
5. **Memory-store hints.** Where the source uses local files / sqlite / "remember.json" / a `state/` folder for persistence across runs, flag it: `_In ren, this belongs in a memory store (read-write, persists across runs) — see [[ren-systems-architect]]._`
6. **Bundled resource layout.** Leave `scripts/`, `references/`, `assets/` as-is. A source's `templates/` folder still ships fine — rename it to `assets/` only if you're already touching it, never as a standalone churn. Other folders (`docs/`, `examples/`, `data/`) ship fine too — don't rename unless ren rejects them. Delete only platform config dirs (step 7).
7. **Strip assistant / platform identity.** Ren agents are user-defined — remove or generalize any specific assistant or runtime:

   | Found                                                 | Substitute with                               |
   | ----------------------------------------------------- | --------------------------------------------- |
   | Claude / Claude Code / Anthropic's Claude             | the agent                                     |
   | Cursor / Copilot / Codex / OpenCode / Cowork / Hermes | the agent                                     |
   | ChatGPT / GPT-4 / OpenAI's GPT (as runtime context)   | the agent                                     |
   | "Claude will read the file…"                          | "the agent reads the file…"                   |
   | "Ask Claude to…"                                      | "ask the agent to…"                           |
   | Proper-noun tools (Read, Edit, Bash, Glob)            | generic capability ("read", "edit", "run")    |
   | "Add this to your Claude Code settings / `.mcp.json`" | _delete entirely_ — handled by ren primitives |
   | "Install in Cursor / VS Code extension"               | _delete entirely_                             |

   If the source ships a `.mcp.json` / `.cursor/` / `.claude/` directory, delete those files — ren attaches MCPs through agent definitions, not file-based config.

8. **Attribution.** Capture provenance so the copy doesn't lose it. Walk back to the earliest known author: existing `ATTRIBUTION.md` / `CREDITS.md` / `AUTHORS`, then `LICENSE` headers, then frontmatter fields you moved in step 1, then the source repo's README / commit history. Record the earliest named author and immediate source in `metadata.author` / `metadata.source`. If the source already had an `ATTRIBUTION.md`, it carries forward verbatim — **never overwrite it**; append a short `## Migrated to ren` section noting the source and date. If the author truly can't be determined, leave `metadata.author` out and say so in the summary.

## Hard rules — do not

- Do not edit the source — only the copy.
- Do not rewrite the `description` for clarity, punchiness, or triggering.
- Do not shorten the body, reformat headings, reflow prose, or reorder sections. Length is not an adaptation concern.
- Do not delete examples, code blocks, or `scripts/` contents.

## Before / after — the minimum-surface edits

| Source pattern                                                              | Adapted pattern                                                                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Set GITHUB_TOKEN in your .env: export GITHUB_TOKEN=ghp_…`                  | _(delete that line)_ + add `GITHUB_TOKEN` to `metadata.requiredCredentials` + insert vault hint line. |
| `{"mcpServers": {"linear": {"command":"npx","args":["-y","@linear/mcp"]}}}` | _This skill expects the `linear` MCP to be attached to the agent. See [[ren-mcp-dev]]._               |
| "First, `wget https://example.com/corpus.csv` into `./data/`."              | "First, the agent reads `corpus.csv` from the attached file store. See [[ren-systems-architect]]."    |
| "Claude will then summarize each row."                                      | "The agent then summarizes each row."                                                                 |
| "Save progress to `./state.json` so you can resume later."                  | "Persist progress to the attached memory store. See [[ren-systems-architect]]."                       |
| Frontmatter: `version: 1.2.0` / `author: Jane Doe` / `tags: [github, ci]`   | Drop `version` (don't relocate). Move `author` + `tags` under `metadata`.                             |
