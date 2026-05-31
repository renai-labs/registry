---
name: ren-vaults-credentials-dev
description: >-
  Manage vaults and credentials - the encrypted secret store that backs skills
  and MCPs. Use when a skill or MCP needs an API key, token, or OAuth
  credential, when running an OAuth connect flow, or when attaching a vault to a
  pod.
---

# Vaults & Credentials Dev

A **vault** is a credential safe. **Credentials** live inside it, encrypted at rest. Secrets never live in prompts — they live in a vault and are injected at runtime.

## Runtime behavior

A credential becomes useful when its vault is attached to a pod. Once attached, every project in the pod can resolve the credential when it runs an agent that needs it — no restart. The same credential backs the same MCP across multiple pods without re-pasting. OAuth tokens refresh on their own server-side; you never paste a token.

## Scope — vaults are scoped, credentials inherit

See [[ren-scope]]. Vaults have no registry tier — only **user** (private to you) or **org** (shared across the org). A credential has no scope of its own: it lives in a vault and inherits the vault's scope. The personal pod's default vault is user-scope — `ren vaults list --scope user` and look for `isDefault: true`.

Vault attachment also follows scope direction (narrower into broader):

- A **user vault** attaches **only to a user-private pod**.
- An **org vault** attaches to **a user-private pod or an org pod**.

You cannot pull a user vault into an org pod. Match scopes before attaching (see [[ren-pod-dev]]).

## How resolution works (the short version)

A skill or MCP declares the env-var name it needs (`requiredCredentials` on a skill, `MCP_<SLUG>_`* derived from the slug for an MCP — see [[ren-mcp-dev]] Runtime behavior). At agent startup the pod walks its attached vaults in priority order and returns the **first match by name**, lower priority wins on conflict. The resolved value lands as an env var (skills, local MCPs) or as a request header (remote MCPs).

OAuth tokens refresh lazily and server-side. For the refresh details (timing, what to do when the refresh token itself expires), see `references/oauth-refresh.md`.

## Two paths to a credential

### OAuth (Linear, Gmail, Notion, …)

The whole flow runs server-side — you never see or paste the token. Ren uses the MCP SDK to discover the provider's OAuth server and do **dynamic client registration (DCR)**, which produces the `authorizationUrl`; after the user consents, the provider redirects to Ren's callback, which exchanges the code for tokens and stores the credential. Your job is start + poll, never the secret.

**Prerequisite:** The MCP must already be defined. If the provider's OAuth server doesn't support DCR, the connect step fails with "Incompatible auth server" — stop immediately and route the user to the Ren web app. Do not retry over CLI; the result won't change.

**Run connects one at a time.** Never start two OAuth connects concurrently — not even for different MCPs — and never fire a connect while another is still polling. Each connect mints its own authorization URL; running them in parallel (or letting a tool call get cancelled and retrying) leaves multiple live URLs, and the user can open a stale one whose provider-side proxy state is incomplete (the symptom is a provider callback erroring with "Missing redirect_uri"). Finish one connect through to `active` before starting the next.

Pass `--scope user` so the owner context resolves the user-scope default vault. Without it, the org-scope vault is used.

1. **Connect.** `ren mcps oauths connect <mcp-id> --scope user --output json` auto-resolves or creates the default vault for that scope, then returns a discriminated result:
  - `{ "alreadyConnected": true, "credentialId": "crd_…" }` → already wired, nothing to do.
  - `{ "alreadyConnected": false, "authorizationUrl": "…", "sessionId": "…" }` → give the URL to the user to open in a browser. Surface **exactly one** URL: if a prior connect call was cancelled or errored, its URL is dead — discard it and only ever hand out the URL from the latest successful connect. Some providers show a redirect confirmation page ("You will be redirected to…") before sending the callback — tell the user to click through it. Then poll immediately without waiting.
2. **Poll the session** until it leaves `pending`:
  ```
   ren mcps oauths session <mcp-id> <session-id> --scope user --output json
  ```
   `status` is one of `pending | active | failed | expired` (session TTL **10 min**). Loop on `pending` every ~2s; don't yield to the user between polls once the URL is out. `active` → the callback has materialized the credential and `credentialId` is populated, done. `failed` / `expired` → surface `failureReason` and restart from connect.

To target a **specific** (non-default) vault instead, swap the first call for `ren credentials oauths start <vault-id> --body '{"mcpId":"mcp_…"}'` (same return shape, plus `state`) and poll `ren credentials oauths session <vault-id> <session-id>`.

### API key / static token

The credential lives inside a vault, so create needs `<vault-id>`. The personal pod has a default vault provisioned and attached already — `ren vaults list --scope user` and look for `isDefault: true`.

## Build via Ren CLI

```
ren vaults list --scope user --output json
ren vaults create --name "team-secrets" --scope user --is-default false
ren credentials create <vault-id> --scope user --body @cred.json --output json
```

`cred.json` (nested `auth` payload — must come via `--body @file`, not inline flags):

```json
{ "name": "GITHUB_TOKEN", "mcpId": "mcp_…", "label": "GitHub PAT", "auth": { "type": "api_key", "value": "ghp_…" } }
```

`name` is the env-var the skill/MCP resolves by. `mcpId` is optional (target-match for an MCP). For OAuth over CLI, use the connect/session commands in the OAuth section above.

## Build via Ren MCP

```
mcp__ren__vault_list        { "query": { "scope": "user" } }
mcp__ren__vault_create      { "query": { "scope": "user" }, "body": { "name": "team-secrets", "isDefault": false } }
mcp__ren__credential_create { "query": { "scope": "user" }, "path": { "vaultId": "vlt_…" },
                              "body": { "name": "GITHUB_TOKEN", "mcpId": "mcp_…",
                                        "auth": { "type": "api_key", "value": "ghp_…" } } }

mcp__ren__mcp_oauth_connect { "query": { "scope": "user" }, "path": { "id": "mcp_…" } }
mcp__ren__mcp_oauth_session { "query": { "scope": "user" }, "path": { "id": "mcp_…", "sessionId": "…" } }
# target a specific vault instead of the default:
mcp__ren__credential_oauth_start   { "query": { "scope": "user" }, "path": { "vaultId": "vlt_…" }, "body": { "mcpId": "mcp_…" } }
mcp__ren__credential_oauth_session { "query": { "scope": "user" }, "path": { "vaultId": "vlt_…", "sessionId": "…" } }
```

## Gotchas

- Never write credential-setup steps into a skill's SKILL.md — the skill assumes the env var is already present (see [[ren-skill-dev]]).
- The credential `name` must equal the skill's declared `requiredCredentials` entry, or the MCP's derived env-var name, or resolution misses and the env var is simply absent at runtime.
- Match scopes before attaching: a user vault won't attach to an org pod.

## Next steps

A credential does nothing until its vault is attached to a pod that runs the agent.

- **Attach the vault to the pod** — `ren pods vaults add <pod-id> --vault-id vlt_… --priority 0`. See [[ren-pod-dev]].
- **Open a session** — the env var resolves at startup and the skill/MCP works. See [[ren-project-dev]] to `sessions create` and hand off its URLs.
- **Add more credentials** to the same vault as you wire more skills/MCPs — one vault can back many.
