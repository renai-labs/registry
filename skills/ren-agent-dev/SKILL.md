---

## name: ren-agent-dev
description: Create, configure, and update agents — their prompt, model, and skill / MCP dependencies. Use when the user asks to build, configure, modify, or debug an agent.

# Agent Dev

Agents are specialized AI assistants configured for specific tasks and workflows — a system prompt + model + dependencies (skills and MCPs). Design them as small atomic units so they compose cleanly, stay debuggable, and can be independently versioned or swapped.

Every version is immutable; `agent.create` always lands an initial `0.0.1` and updates publish a new version. One new version = one logical change.

## Runtime behavior

An agent version is an immutable snapshot of the prompt, model, and skill/MCP versions it depends on. By default a project attaches to the agent's **latest** version (`agentVersionId` omitted on attach) and **auto-rolls-forward**: publishing a new version propagates to every project using it without a restart. Pin a specific `agentVersionId` on attach (see [[ren-project-dev]]) only to freeze a snapshot.

## Scope

See [[ren-scope]]. Pass `--scope user` / `"query": { "scope": "user" }` on every command (create, get, update, `versions create`) when the agent lives in your user namespace; omit for org. `search` is the exception — it uses `--sources` (read-time filter across user/org/registry tiers) and ignores `--scope`.

## Build via Ren CLI

`agents create` returns an agent with its initial version (`0.0.1`):

```
ren agents create --name "My Agent" --icon "🤖" \
  --scope user \
  --prompt "You are…" --model "claude-sonnet-4-6" \
  --release-notes "initial" \
  --body '{
    "skills": [{ "skillId": "skl_…" }],
    "mcps":   [{ "mcpId":   "mcp_…" }]
  }'
```

Subsequent revisions go through `agents versions create`:

```
ren agents versions create agt_… \
  --scope user \
  --prompt "You are…" \
  --model "claude-sonnet-4-6" \
  --release-notes "…" \
  --body '{
    "skills": [{ "skillId": "skl_…" }, { "skillId": "skl_…" }],
    "mcps":   [{ "mcpId": "mcp_…" }],
    "version": "patch"
  }'
```

`--body` accepts a JSON string, `@file.json`, or `@-`. Scalar flags merge over `--body`. Read with `ren agents get agt_… --scope user`; discover across scopes with `ren agents search --query "…" --sources user org registry`.

## Build via Ren MCP

`{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__agent_create         { "query": { "scope": "user" },
                                 "body":  { "name": "My Agent", "icon": "🤖",
                                            "prompt": "…", "model": "claude-sonnet-4-6",
                                            "skills": [{ "skillId": "skl_…" }],
                                            "mcps":   [{ "mcpId":   "mcp_…" }],
                                            "releaseNotes": "initial" } }
mcp__ren__agent_version_create { "query": { "scope": "user" },
                                 "path":  { "id": "agt_…" },
                                 "body":  { "prompt": "…", "model": "claude-sonnet-4-6",
                                            "skills": [{ "skillId": "skl_…" }],
                                            "mcps":   [{ "mcpId":   "mcp_…" }],
                                            "version": "patch" } }
mcp__ren__agent_get            { "query": { "scope": "user" }, "path": { "id": "agt_…" } }
mcp__ren__agent_search         { "body": { "query": "…", "sources": ["user","org","registry"] } }
```

## Choosing the model

**Do not pick a model silently. Stop and ask the user before creating the agent.**
Run `ren models list --output json` to get the live catalog — Ren supports models from many providers; the full list is always in the catalog. From that list, surface three options across the price/capability range (heavy / balanced / light) with a one-line trade-off each. Suggested defaults: **Claude Opus 4.7** for heavy work, **Claude Sonnet 4.6** balanced, **Claude Haiku 4.5** for light/cheap. Enrich each with `$/M input` + `$/M output` from the provider's public pricing. Pass `--model null` (via `--body '{"model":null}'`) to inherit the pod default.

## Easy to miss

- Pass the prompt via `--body @file.json` for anything over a few lines — inline JSON breaks on quotes, backticks, and code fences.
- `skills` / `mcps` are **full-replace** lists of `{ skillId }` / `{ mcpId }` objects. To add one skill, `ren agents get` first and pass the union. Omit `skillVersionId` to track latest (auto-roll-forward); pin it only to freeze.
- Keep the prompt focused: role → workflow → output format → rules. Push detail into skills, not the prompt. See `references/prompt-writing.md` and `references/dependency-patterns.md`.

## Iterate

1. `ren agents get` — verify current state.
2. Watch a real run — find the wrong output.
3. `ren skills versions create` to fix skill content, `ren agents versions create` to fix prompt or deps.

## Next steps

An agent does nothing until a project routes to it.

- **Attach to a project** as `primary` so chat sessions and triggers route to it. See [[ren-project-dev]].
- **Wire its credentials** if any skill or MCP it depends on needs auth. See [[ren-vaults-credentials-dev]] (and [[ren-mcp-dev]] for OAuth).
- **Give it persistent context** with a memory store, or feed it artifacts via a file store. See [[ren-file-memory-store-dev]].
- **Run it on a schedule** once a session works manually. See [[ren-trigger-dev]].

