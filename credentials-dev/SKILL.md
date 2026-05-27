---
name: credentials-dev
description: Manage vaults and credentials — the encrypted secret store that backs skills and MCPs. Use when a skill or MCP needs an API key, token, or OAuth credential, or when attaching a vault to a pod.
---

# Credentials Dev

A **vault** is a credential safe (org- or user-scoped). **Credentials** live inside it, encrypted at rest. Secrets never live in prompts — they live in a vault and are injected at runtime.

## Lifecycle in the manifested sandbox

Vaults attach to a pod via `podVault` with a **priority order**. At agent startup, when a skill or MCP needs a secret, the pod walks its attached vaults and returns the **first match** by name (e.g. `GITHUB_TOKEN`) or by target (`mcpId`) — on conflict, lower priority wins. The resolved value lands in the manifest's `environment` map and is injected as an env var (local MCP / skill) or request header (remote MCP).

This decoupling is the point: the **same credential backs the same MCP across multiple pods** without re-pasting. Adding a vault to a pod bumps the manifest and fans out.

A skill declares the secrets it needs as `requiredCredentials` (UPPER_SNAKE_CASE env names). If the vault stack can't resolve them, the skill is skipped — so the credential's *name* must match what the skill expects.

## Two paths

### OAuth (Linear, Gmail, Notion, …) — preferred

Don't hand-create these. `ren mcps oauths connect` resolves or creates the default vault and stores the credential server-side. See [mcp-dev].

### API key / static token

The credential lives inside a vault, so the create path needs `<vault-id>`. The personal pod has a default vault provisioned and attached already.

## Build via CLI

```
ren vaults list --output json                 # find isDefault: true
ren credentials create <vault-id> --body @cred.json --output json
```

`cred.json` (nested `auth` payload — must come via `--body @file`, not inline flags):

```json
{ "name": "GITHUB_TOKEN", "mcpId": "mcp_…", "label": "GitHub PAT", "auth": { "type": "api_key", "value": "ghp_…" } }
```

`name` is the env-var the skill/MCP resolves by. `mcpId` is optional (target-match for an MCP). Create a vault explicitly only when you need a separate boundary:

```
ren vaults create --name "team-secrets" --is-default false
```

## Build via MCP

```
mcp__ren__vault_list        {}
mcp__ren__credential_create { "vaultId": "vlt_…", "name": "GITHUB_TOKEN", "auth": { "type": "api_key", "value": "ghp_…" } }
mcp__ren__credential_oauth_start   { … }   # programmatic oauth where supported
mcp__ren__credential_oauth_session { … }
```

## Gotchas

- Never write credential-setup steps into a skill's SKILL.md — the skill assumes the env var is already present (see [skill-dev]).
- The credential `name` must equal the skill's declared `requiredCredentials` entry, or resolution misses and the skill is skipped.
- Attaching a vault to a pod is a [pod-dev] operation (`ren pods vaults add`); creating the credential is here.
