---
name: vaults-credentials-dev
description: Manage vaults and credentials - the encrypted secret store that backs skills and MCPs. Use when a skill or MCP needs an API key, token, or OAuth credential, when running an OAuth connect flow, or when attaching a vault to a pod.
---

# Vaults & Credentials Dev

A **vault** is a credential safe. **Credentials** live inside it, encrypted at rest. Secrets never live in prompts — they live in a vault and are injected at runtime.

## Runtime behavior

A credential becomes useful when its vault is attached to a pod. Once attached, every project in the pod can resolve the credential when it runs an agent that needs it — no restart. The same credential backs the same MCP across multiple pods without re-pasting. OAuth tokens refresh on their own server-side; you never paste a token.

## Scope — vaults are scoped, credentials inherit

A vault is either **user** (private to you) or **org** (shared across the org). Scope is set at create time — `--scope user|org` (CLI) / `query.scope` (MCP) — and defaults to **`org`**; pass `--scope user` for a private vault. A credential has **no scope of its own**: it lives in a vault and inherits the vault's. A secret's reach is exactly its vault's reach.

Scope narrows one way when you attach a vault to a pod (narrower into broader):

- A **user vault** attaches **only to a user-private pod**.
- An **org vault** attaches to **a user-private pod or an org pod**.

You cannot pull a user vault into an org pod — the pod can't reach down into a narrower scope. Match scopes before attaching (see [[pod-dev]]).

## How resolution works (the short version)

A skill or MCP declares the env-var name it needs (`requiredCredentials` on a skill, `MCP_<SLUG>_*` derived from the slug for an MCP — see `mcp-dev/references/auth-config.md`). At agent startup the pod walks its attached vaults in priority order and returns the **first match by name**, lower priority wins on conflict. The resolved value lands as an env var (skills, local MCPs) or as a request header (remote MCPs).

OAuth tokens refresh lazily and server-side. For the refresh details (timing, what to do when the refresh token itself expires), see `references/oauth-refresh.md`.

## Two paths to a credential

### OAuth (Linear, Gmail, Notion, …) - preferred

Don't hand-build these — the token is minted by the provider through a browser consent flow, and Ren materializes the credential **server-side** from the callback. You never see or paste the token; you only drive **start → hand off the URL → poll**.

OAuth requires an MCP already defined for the provider. If you don't have one, start in [[mcp-dev]] (the registry usually has it).

1. **Connect.** `ren mcps oauths connect <mcp-id> --output json` resolves or creates the default vault, then returns a discriminated result:
   - `{ "alreadyConnected": true, "credentialId": "crd_…" }` → already wired, nothing to do.
   - `{ "alreadyConnected": false, "authorizationUrl": "…", "sessionId": "…" }` → give the URL to the user to open in a browser, then poll.
2. **Poll the session** until it leaves `pending`:
   ```
   ren mcps oauths session <mcp-id> <session-id> --output json
   ```
   `status` is one of `pending | active | failed | expired` (session TTL **10 min**). Loop on `pending` every ~2s; don't yield to the user between polls once the URL is out. `active` → the callback has materialized the credential and `credentialId` is populated, done. `failed` / `expired` → surface `failureReason` and restart from connect.

To target a **specific** (non-default) vault instead, swap the first call for `ren credentials oauths start <vault-id> --body '{"mcpId":"mcp_…"}'` (same return shape, plus `state`) and poll `ren credentials oauths session <vault-id> <session-id>`.

### API key / static token

The credential lives inside a vault, so create needs `<vault-id>`. The personal pod has a default vault provisioned and attached already — `ren vaults list` and look for `isDefault: true`.

## Build via CLI

```
ren vaults list --output json                                       # find isDefault: true
ren vaults create --name "team-secrets" --scope user --is-default false   # only for a separate boundary
ren credentials create <vault-id> --body @cred.json --output json
```

`cred.json` (nested `auth` payload — must come via `--body @file`, not inline flags):

```json
{ "name": "GITHUB_TOKEN", "mcpId": "mcp_…", "label": "GitHub PAT", "auth": { "type": "api_key", "value": "ghp_…" } }
```

`name` is the env-var the skill/MCP resolves by. `mcpId` is optional (target-match for an MCP).

OAuth over CLI:

```
ren mcps oauths connect <mcp-id> --output json                # → alreadyConnected, or authorizationUrl + sessionId
ren mcps oauths session <mcp-id> <session-id> --output json   # poll until status: active
```

## Build via MCP

MCP tools take the `{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__vault_list        {}
mcp__ren__vault_create      { "query": { "scope": "user" }, "body": { "name": "team-secrets", "isDefault": false } }
mcp__ren__credential_create { "path": { "vaultId": "vlt_…" },
                              "body": { "name": "GITHUB_TOKEN", "mcpId": "mcp_…",
                                        "auth": { "type": "api_key", "value": "ghp_…" } } }

mcp__ren__mcp_oauth_connect { "path": { "id": "mcp_…" } }                          # → alreadyConnected | authorizationUrl + sessionId
mcp__ren__mcp_oauth_session { "path": { "id": "mcp_…", "sessionId": "…" } }        # poll until active
# target a specific vault instead of the default:
mcp__ren__credential_oauth_start   { "path": { "vaultId": "vlt_…" }, "body": { "mcpId": "mcp_…" } }
mcp__ren__credential_oauth_session { "path": { "vaultId": "vlt_…", "sessionId": "…" } }
```

## Gotchas

- Never write credential-setup steps into a skill's SKILL.md — the skill assumes the env var is already present (see [[skill-dev]]).
- The credential `name` must equal the skill's declared `requiredCredentials` entry, or the MCP's derived env-var name, or resolution misses and the env var is simply absent at runtime.
- Match scopes before attaching: a user vault won't attach to an org pod.
- OAuth tokens never pass through you — the provider callback stores them server-side. Your job is start + poll, not handling the secret.

## Next steps

A credential does nothing until its vault is attached to a pod that runs the agent.

- **Attach the vault to the pod** — `ren pods vaults add <pod-id> --vault-id vlt_… --priority 0`. See [[pod-dev]].
- **Open a session** — the env var resolves at startup and the skill/MCP works. See [[project-dev]] for the deep link.
- **Add more credentials** to the same vault as you wire more skills/MCPs — one vault can back many.
