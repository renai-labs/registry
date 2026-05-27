---
name: vaults-credentials-dev
description: Manage vaults and credentials - the encrypted secret store that backs skills and MCPs. Use when a skill or MCP needs an API key, token, or OAuth credential, when running an OAuth connect flow, or when attaching a vault to a pod.
---

# Vaults & Credentials Dev

A **vault** is a credential safe. **Credentials** live inside it, encrypted at rest. Secrets never live in prompts - they live in a vault and are injected at runtime.

## Scope - vaults are scoped, credentials inherit

A vault is either **user** (private to you) or **org** (shared across the org). Scope is set at create time - `--scope user|org` (CLI) / `query.scope` (MCP) - and **defaults to `org`** like every other entity; pass `--scope user` for a private vault. A credential has **no scope of its own**: it lives in a vault and inherits the vault's. A secret's reach is exactly its vault's reach.

Scope narrows one way when you attach a vault to a pod (same rule as everywhere on Ren - narrower into broader):

- A **user vault** attaches **only to a user-private pod**.
- An **org vault** attaches to **a user-private pod or an org pod**.

You cannot pull a user vault into an org pod - the pod can't reach down into a narrower scope. Match scopes before attaching (see [pod-dev]).

## Lifecycle in the manifested sandbox

Vaults attach to a pod via `podVault` with a **priority order**. At agent startup, when a skill or MCP needs a secret, the pod walks its attached vaults and returns the **first match** by name (e.g. `GITHUB_TOKEN`) or by target (`mcpId`) - on conflict, lower priority wins. The resolved value lands in the manifest's `environment` map and is injected as an env var (local MCP / skill) or request header (remote MCP).

This decoupling is the point: the **same credential backs the same MCP across multiple pods** without re-pasting. Adding a vault to a pod bumps the manifest and fans out.

**OAuth tokens refresh on their own, server-side.** An OAuth credential also holds `expiresAt` and a `refresh` block (refresh token + token endpoint). Refresh is **lazy, not scheduled**: every time Ren *resolves* the credential it checks `expiresAt`, and if the token is past it or within ~10 min of expiry, it runs a standard `refresh_token` grant and writes the rotated token back to the credential row (re-encrypted) before handing it out. The sandbox keeps requesting manifest builds every 2minutes, and this refresh check runs repeatedly, so running sandboxes always have valid tokens. Refresh only saves you while the **refresh token** is valid; if the provider revokes it, the grant fails and you fall back to a fresh OAuth connect.

A skill declares the secrets it needs as `requiredCredentials` (UPPER_SNAKE_CASE env names). At startup the pod resolves them from this vault stack and injects the hits; an unresolved one is simply an **absent env var** - the skill still runs and fails when it reaches for the missing variable (it is **not** skipped). So the credential's *name* must match what the skill expects (see [skill-dev]).

## Two paths to a credential

### OAuth (Linear, Gmail, Notion, …) - preferred

Don't hand-build these - the token is minted by the provider through a browser consent flow, and Ren materializes the credential **server-side** from the callback. You never see or paste the token; you only drive **start → hand off the URL → poll**.

1. **Connect.** `ren mcps oauths connect <mcp-id> --output json` resolves or creates the default vault, then returns a discriminated result:
   - `{ "alreadyConnected": true, "credentialId": "crd_…" }` → already wired, nothing to do.
   - `{ "alreadyConnected": false, "authorizationUrl": "…", "sessionId": "…" }` → give the URL to the user to open in a browser, then poll.
2. **Poll the session** until it leaves `pending`:
   ```
   ren mcps oauths session <mcp-id> <session-id> --output json
   ```
   `status` is one of `pending | active | failed | expired` (session TTL **10 min**). Loop on `pending` every ~2s (what the UI does); **don't yield to the user between polls** once the URL is out. `active` → the callback has materialized the credential and `credentialId` is populated, done. `failed` / `expired` → surface `failureReason` and restart from connect.

To target a **specific** (non-default) vault instead, swap the first call for `ren credentials oauths start <vault-id> --body '{"mcpId":"mcp_…"}'` (same return shape, plus `state`) and poll `ren credentials oauths session <vault-id> <session-id>`.

### API key / static token

The credential lives inside a vault, so create needs `<vault-id>`. The personal pod has a default vault provisioned and attached already - `ren vaults list` and look for `isDefault: true`.

## Build via CLI

```
ren vaults list --output json                                       # find isDefault: true
ren vaults create --name "team-secrets" --scope user --is-default false   # only for a separate boundary
ren credentials create <vault-id> --body @cred.json --output json
```

`cred.json` (nested `auth` payload - must come via `--body @file`, not inline flags):

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

- Never write credential-setup steps into a skill's SKILL.md - the skill assumes the env var is already present (see [skill-dev]).
- The credential `name` must equal the skill's declared `requiredCredentials` entry, or resolution misses and the env var is simply absent at runtime.
- Match scopes before attaching: a user vault won't attach to an org pod. Attaching a vault to a pod is a [pod-dev] op (`ren pods vaults add`); creating the credential is here.
- OAuth tokens never pass through you - the provider callback stores them server-side. Your job is start + poll, not handling the secret.
