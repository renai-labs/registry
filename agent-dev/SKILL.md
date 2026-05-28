---

## name: agent-dev

description: Create, configure, and update agents — their prompt, model, and skill / MCP dependencies. Use when the user asks to build, configure, modify, or debug an agent.

# Agent Dev

An agent is a system prompt + model + dependencies (skills and MCPs). Agents are version-controlled and **always have at least one version** - `agent.create` writes the agent row and an initial version (`0.0.1`, semver-bumped from a `0.0.0` base) in one transaction. Every version is immutable; you never edit a published version in place. Updating an agent means publishing a new version that replaces the previous one. One new version = one logical change to that bundle.

## Lifecycle in the manifested sandbox

An agent is a reusable blueprint (one slug per org); an **agent version** is the published snapshot with the baked-in prompt, model, and **pinned** skill/MCP versions. When the agent is attached to a project, that version is pinned too — newer versions don't auto-roll-forward.

At sandbox compose time the version becomes the project's `opencode.json`: the prompt is injected (along with current time, timezone, and the mounted volume paths), and the model resolves to `proxy/<name>` so it runs through the pod's per-sandbox proxy key — that's how any model at any price tier works without a config change. Skills materialize under the project's `.opencode/skills/`; MCP credentials are injected from the vault. The project's **primary** agent is what triggers and chat sessions route to; **subagents** are called from within. Publishing a new version bumps the pod manifest and fans out.

Favor many small specialists composing over one giant agent — easier to version, swap models for, and debug.

## Build via CLI

`agents create` always returns an agent with its initial version (`0.0.1`) attached; the version fields you pass populate it - if you omit them, you still get a `0.0.1`, just empty (no prompt, no model, no deps):

```
ren agents create --name "My Agent" --icon "🤖" \
  --prompt "You are…" --model "claude-sonnet-4-6" \
  --release-notes "initial" \
  --body '{
    "skills": [{ "skillId": "skl_…" }],
    "mcps":   [{ "mcpId":   "mcp_…" }]
  }'                                                # → agentId (with version 0.0.1 fully populated)
```

It accepts the same version fields as a bump (`--prompt`, `--model`, `--description`, `--release-notes`, plus `skills`/`mcps` via `--body`), so the first call can stand on its own without a follow-up `versions create`. Subsequent revisions go through `agents versions create` (scalar fields on flags; nested fields via `--body`):

```
ren agents versions create agt_… \
  --prompt "You are…" \
  --model "claude-sonnet-4-6" \
  --release-notes "…" \
  --body '{
    "skills": [{ "skillId": "skl_…" }, { "skillId": "skl_…" }],
    "mcps":   [{ "mcpId": "mcp_…" }],
    "version": "patch"
  }'
```

`--body` accepts a JSON string, `@file.json`, or `@-`. Scalar flags merge over `--body`. Read with `ren agents get agt_…`; discover across scopes with `ren agents search --query "…" --sources user org registry` (there is no separate `agents list`).

## Build via MCP

`{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__agent_create         { "body": { "name": "My Agent", "icon": "🤖",
                                            "prompt": "…", "model": "claude-sonnet-4-6",
                                            "skills": [{ "skillId": "skl_…" }],
                                            "mcps":   [{ "mcpId":   "mcp_…" }],
                                            "releaseNotes": "initial" } }
mcp__ren__agent_version_create { "path": { "id": "agt_…" },
                                 "body": { "prompt": "…", "model": "claude-sonnet-4-6",
                                            "skills": [{ "skillId": "skl_…" }],
                                            "mcps":   [{ "mcpId":   "mcp_…" }],
                                            "version": "patch" } }
mcp__ren__agent_get            { "path": { "id": "agt_…" } }
mcp__ren__agent_search         { "body": { "query": "…", "sources": ["user","org","registry"] } }
```

## Choosing the model — surface options, don't pick silently

Pull the catalog, then offer **three options across the price/capability range** rather than choosing for the user:

```
ren models list --output json
```

- a **heavier** model for involved work (long reasoning, code, multi-step research),
- a **balanced** default (recommend this one),
- a **lighter/cheaper** option for summaries or routing.

Pricing isn't on the endpoint — enrich from the provider's public pricing and show `$/M input` + `$/M output` alongside each. Match the spread to the task. Pass `--model null` (via `--body '{"model":null}'`) to inherit the pod default.

### Suggested picks

Use as defaults when you don't have a stronger contextual reason. Prices = `$/M input / $/M output`. Re-check rankings periodically — the heavy tier in particular reshuffles within statistical noise.


| Tier       | Frontier                                                                                                                                                                                                                                                                                       | Price-sensitive                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Heavy**  | **Claude Opus 4.7** — `$5 / $25`, Max-eligible. AA Intelligence Index 57 (tied #1), SWE-bench Verified 87.6%, top SWE-bench Pro. **GPT-5.5** — `$5 / $30`. Leads SWE-bench Verified at 88.7% (essentially tied with Opus 4.7 within noise); pick when the user wants a non-Anthropic frontier. | **DeepSeek V4 Pro** — `$0.44 / $0.87`. AA Index 52, GPQA 90.1, ~10× cheaper than Opus.                   |
| **Medium** | **Claude Sonnet 4.6** — `$3 / $15`, Max-eligible. SWE-bench Verified 75-80%, leads pro-writing GDPval, 2-3× faster tokens/sec than GPT-5.4.                                                                                                                                                    | **GLM-4.7** — `$0.40 / $1.75`. Open-weight, same family as GLM-5.1 which tops open-source SWE-bench Pro. |
| **Light**  | **Gemini 3.1 Flash Lite** — `$0.25 / $1.50`. Outperforms Haiku 4.5 on MMMLU (88.9 vs 83), GPQA, AIME, at ¼ the price + 1M context. **Claude Haiku 4.5** — `$1 / $5`, Max-eligible. Behind Gemini on most benchmarks.                                                                           | **GLM-4.7 Flash** — `$0.06 / $0.40`. Rock-bottom price for routing/summarisation.                        |


## Easy to miss

- Pass the prompt via `--body @file.json` for anything over a few lines — inline JSON breaks on quotes, backticks, and code fences.
- `skills` / `mcps` are **full-replace** lists of `{ skillId }` / `{ mcpId }` objects (skills may pin `skillVersionId`). To add one, `ren agents get` first and pass the union; omit to inherit the previous version's deps.
- Keep the prompt focused: role → workflow → output format → rules, with failure modes next to the decisions they govern. Push detail into skills, not the prompt. See `references/prompt-writing.md` and `references/dependency-patterns.md`.

## Iterate

1. `ren agents get` — verify current state.
2. Watch a real run — find the wrong output.
3. `ren skills versions create` to fix skill content, `ren agents versions create` to fix prompt or deps.

