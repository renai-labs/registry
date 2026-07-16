---
name: ren-vaults-credentials-dev
description: >-
  Manage vaults and credentials - the encrypted secret store that backs skills
  and MCPs. Use when a skill or MCP needs an API key, token, or OAuth
  credential, when running an OAuth connect flow, or when attaching a vault to a
  pod.
metadata:
  tags:
    - ren
---

# Vaults & Credentials Dev

> This skill is the **OAuth / API-key choreography and the gotchas** on top. What a vault and a credential are, vault scope tiers and inheritance, and the resolution model (priority walk, first-match-by-name, env var vs header) are design — see [[ren-systems-architect]] / `ren docs model`. Commands and flags (`vaults`, `credentials`, the OAuth verbs): `ren docs commands`.

## Scope — operational

The personal pod's default vault is user-scope — `ren vaults list --scope user`, look for `isDefault: true`. A user vault attaches only to a user-private pod; an org vault attaches to either — match scopes before attaching. (Tiers, inheritance, resolution: [[ren-systems-architect]] / `ren docs model`.)

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

OAuth tokens then refresh lazily and server-side. For the refresh details (timing, what to do when the refresh token itself expires), see `references/oauth-refresh.md`.

### API key / static token

The credential lives inside a vault, so create needs `<vault-id>`. The personal pod's default vault is already provisioned and attached — `ren vaults list --scope user`, look for `isDefault: true`. The `auth` payload is nested, so it must come via `--body @file` (not inline flags):

```json
{ "name": "GITHUB_TOKEN", "mcpId": "mcp_…", "label": "GitHub PAT", "auth": { "type": "api_key", "value": "ghp_…" } }
```

`name` is the env-var the skill/MCP resolves by. `mcpId` is optional (target-match for an MCP).

## Gotchas

- Never write credential-setup steps into a skill's SKILL.md — the skill assumes the env var is already present (see [[ren-skill-dev]]).
- The credential `name` must equal the skill's declared `requiredCredentials` entry, or the MCP's derived env-var name ([[ren-mcp-dev]]), or resolution misses and the env var is simply absent at runtime.

## Next steps

A credential does nothing until its vault is attached to a pod that runs the agent.

- **Attach the vault to the pod** — `ren pods vaults add <pod-id> --vault-id vlt_… --priority 0`. See [[ren-systems-architect]].
- **Open a session** — the env var resolves at startup and the skill/MCP works. See [[ren-systems-architect]] for the deep link.
- **Add more credentials** to the same vault as you wire more skills/MCPs — one vault can back many.
