---
name: agent-dev
description: Create, configure, and update agents — their prompt, model, and skill / MCP dependencies. Use when the user asks to build, configure, modify, or debug an agent.
---

# Agent Dev

An agent is a system prompt + model + dependencies (skills and MCPs). Agents are version-controlled: every version is immutable, `agent.create` always lands an initial `0.0.1`, and updates publish a new version. One new version = one logical change.

Favor many small specialists composing over one giant agent — easier to version, swap models for, and debug.

## Runtime behavior

An agent version is an immutable snapshot — the prompt, model, and the skill/MCP versions it depends on. By default a project attaches to the agent's **latest** version (`agentVersionId` omitted on attach) and **auto-rolls-forward**: publishing a new version propagates to every project using it without a restart. Pin a specific `agentVersionId` on attach (see [[project-dev]]) only when you need to freeze a snapshot for that project.

## Scope

`--scope` (CLI) / `query.scope` (MCP) defaults to **`org`** (visible to the whole org). Pass `--scope user` to keep the agent in your **private namespace**. Scope narrows one way: a `user` agent can attach to a user-private pod's project; an `org` agent works in both org and user-private pods.

## Build via Ren CLI

`agents create` always returns an agent with its initial version (`0.0.1`) attached; the version fields you pass populate it - if you omit them, you still get a `0.0.1`, just empty:

```
ren agents create --name "My Agent" --icon "🤖" \
  --scope user \
  --prompt "You are…" --model "claude-sonnet-4-6" \
  --release-notes "initial" \
  --body '{
    "skills": [{ "skillId": "skl_…" }],
    "mcps":   [{ "mcpId":   "mcp_…" }]
  }'                                                # → agentId
```

Subsequent revisions go through `agents versions create` (scalar fields on flags; nested fields via `--body`):

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

`--body` accepts a JSON string, `@file.json`, or `@-`. Scalar flags merge over `--body`. Read with `ren agents get agt_…`; discover across scopes with `ren agents search --query "…" --sources user org registry`.

## Build via Ren MCP

`{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__agent_create         { "query": { "scope": "user" },
                                 "body":  { "name": "My Agent", "icon": "🤖",
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

Over MCP, `scope` lives under `query` and its only value is `"user"` - omit it for the `org` default.

## Choosing the model — surface options, don't pick silently

Pull the catalog with `ren models list --output json` and offer the user three picks across the price/capability range — heavy, balanced, light — instead of choosing silently. Suggested defaults: **Claude Opus 4.7** for heavy work, **Claude Sonnet 4.6** as the balanced recommendation, **Claude Haiku 4.5** for light/cheap. Enrich each with `$/M input` + `$/M output` from the provider's public pricing. Pass `--model null` (via `--body '{"model":null}'`) to inherit the pod default.

## Easy to miss

- Pass the prompt via `--body @file.json` for anything over a few lines — inline JSON breaks on quotes, backticks, and code fences.
- `skills` / `mcps` are **full-replace** lists of `{ skillId }` / `{ mcpId }` objects. To add one, `ren agents get` first and pass the union; omit to inherit the previous version's deps. Omit `skillVersionId` to track the skill's latest version (auto-roll-forward); pin it only to freeze.
- Keep the prompt focused: role → workflow → output format → rules, with failure modes next to the decisions they govern. Push detail into skills, not the prompt. See `references/prompt-writing.md` (read when drafting or refactoring a prompt) and `references/dependency-patterns.md` (read when deciding what belongs in the prompt vs a skill).

## Iterate

1. `ren agents get` — verify current state.
2. Watch a real run — find the wrong output.
3. `ren skills versions create` to fix skill content, `ren agents versions create` to fix prompt or deps.

## Next steps

An agent does nothing until a project routes to it.

- **Attach to a project** as `primary` so chat sessions and triggers route to it. See [[project-dev]].
- **Wire its credentials** if any skill or MCP it depends on needs auth. See [[vaults-credentials-dev]] (and [[mcp-dev]] for OAuth).
- **Give it persistent context** with a memory store, or feed it artifacts via a file store. See [[file-memory-store-dev]].
- **Run it on a schedule** once a session works manually. See [[trigger-dev]].
