# Ren operations — composing the artifacts

Command-level mechanics for the build chain's composable artifacts: skills, MCPs, agents, and the credential wiring that backs them. The architect body owns the decisions (reuse-first, scope, ordering); this file is how to actually mutate Ren. The dev skills ([[ren-skill-dev]], [[ren-agent-dev]], [[ren-mcp-dev]]) hold authoring craft only — load one to *write* a custom artifact well, not to run these commands. Full flag detail: `ren docs commands` (CLI) or the equivalent `mcp__ren__*` tools (MCP transport).

## Skills

- **Search.** `ren skills list` shows only your own items; only `ren skills search --sources user org registry` reaches the registry. Which skill per task → `ren docs integrations`.
- **Inspect before forking.** `ren skills versions data <id> <version> --scope user --format presigned` downloads a skill's bundled files so you can judge whether to fork.
- **Fork.** `ren skills copy <id> --scope user --name "my-variant"` copies a skill into your scope as an editable copy, leaving the original untouched (`--scope user` to read a user-scope source; registry/org sources don't need it).
- **Author custom.** The authoring craft is [[ren-skill-dev]] (incl. adapting a forked or community SKILL.md). Then create it (below).
- **Create / publish / version.** `ren skills create`; version bumps are Ren-owned — never put `version` in frontmatter.
- **Scope.** A `user` skill can back a `user` or `org` agent, but you can't pull a narrower-scope skill into a broader-scope publication.
- **Attach to an agent.** Add the `skillId` to the agent version's `skills: [{ skillId }]` list (full-replace — see §Agents).

## MCPs

- **Registry first.** Ren ships a public registry of tested, production-ready MCPs (server URL, transport, auth config already correct) — always prefer one over rolling your own. `ren mcps search --sources user org registry` is the live search; the index is `ren docs integrations`. Register a custom remote MCP → [[ren-mcp-dev]] (definition craft + the `validate-mcp.js` validator), then create it (below).
- **Commands.** `ren mcps search / get / get-by-slug / create / update`, plus the OAuth verbs.
- **Create mechanics.** `authConfig` is nested, so it goes through `--body` on create.
- **Scope.** `--sources` (the read-time tier filter on `mcps search`) and `--scope` (the auth-resolution lens on every other command) are different flags. If a valid MCP id 404s, missing `--scope user` is the first thing to check.
- **Authorize.** OAuth — `ren mcps oauths connect <mcp-id>` runs the consent flow and resolves the default vault automatically — or an API-key credential in a vault. Choreography and gotchas: [[ren-vaults-credentials-dev]].
- **Attach to an agent.** Add the id to the agent version's `mcps: [{ mcpId }]` list.

## Agents

- **Commands.** `ren agents create`, `ren agents versions create`, `ren agents get`, `ren agents search`.
- **Model catalog.** `ren models list --output json` for the live catalog (many providers). Pass `--model null` (via `--body '{"model":null}'`) to inherit the pod default. The choice *judgment* — stop and ask the user, present heavy/balanced/light with pricing — is [[ren-agent-dev]].
- **Create mechanics.** Pass the prompt via `--body @file.json` for anything over a few lines — inline JSON breaks on quotes, backticks, and code fences. `skills` / `mcps` are **full-replace** lists of `{ skillId }` / `{ mcpId }`; to add one, `ren agents get` first and pass the union. Omit `skillVersionId` / `agentVersionId` to track latest (auto-roll-forward); pin only to freeze.
- **Scope.** Pass `--scope user` on every command when the agent lives in the user namespace; `search` is the exception (it uses `--sources`).
- **Iterate.** `ren agents get` (verify state) → `ren skills versions create` (fix skill content) / `ren agents versions create` (fix prompt or deps). The discipline — one logical change per version, fix from real runs — is [[ren-agent-dev]].
- **Attach to a project.** As `primary` so chat sessions and triggers route to it → `references/wiring.md` (§Projects).

## Credentials

The design (what a vault is, scope, resolution) is in the architect body; the OAuth connect/poll flow, DCR-incompatible handling, the one-connect-at-a-time hazard, the API-key `--body` shape, and lazy refresh are all in [[ren-vaults-credentials-dev]]. A credential does nothing until its vault is attached to the pod that runs the agent — attach the vault (`references/wiring.md`, §Pods) and the env var resolves at session startup.
