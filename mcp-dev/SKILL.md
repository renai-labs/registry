---
name: mcp-dev
description: Discover, attach, and authorize MCP servers — the third-party tool surfaces an agent can call (Linear, Gmail, GitHub, …). Use when an agent needs an external tool, or when wiring OAuth / API-key auth for one.
---

# MCP Dev

An MCP is a third-party tool surface. Agents reference MCPs by id; the platform wires the connection and injects credentials at startup. Always search the registry before assuming you need a custom one.

## Lifecycle in the manifested sandbox

How an attached MCP comes alive depends on where it runs:

- **Remote MCP** — runs out-of-band at a URL. The platform resolves its credentials from the pod's vault stack and passes them as **request headers** at agent startup.
- **Local MCP** — spawns *inside* the pod sandbox via `command + args`. Credentials are resolved and injected as **environment variables** before the process starts.

Auth modes: `none` / `oauth` / `api_key` / `basic`. At agent startup the manifest's `environment` map carries the resolved secrets; if the pod's vault stack can't satisfy an MCP's auth config, that MCP simply isn't available to the agent. Attaching an MCP to an agent version bumps the pod manifest and fans out — no restart.

The agent never sees raw secrets in its prompt; it just calls the tool.

## Build via CLI

Discover first (default sources span all three scopes):

```
ren mcps search --query "<topic>" --sources user org registry --output json
ren mcps get <mcp-id> --output json          # inspect auth mode + transport
```

Authorize, if the MCP needs it. `oauths connect` resolves (or creates) the user's default vault server-side — **no separate vault step**:

```
ren mcps oauths connect <mcp-id> --output json
```

Two response shapes:

- `{ "alreadyConnected": true, "credentialId": "…" }` → credential exists; **skip the URL dance**, move on.
- `{ "alreadyConnected": false, "authorizationUrl": "…", "sessionId": "…" }` → hand the URL to the user in one sentence, then poll silently (don't yield between polls):
  ```
  ren mcps oauths session <mcp-id> <session-id> --output json   # loop until complete | expired | denied
  ```

For API-key / basic MCPs, the credential goes into a vault instead — see [credentials-dev]. You attach the MCP to the agent by id in [agent-dev] (`mcpIds`).

## Build via MCP

```
mcp__ren__mcp_search        { "query": "<topic>", "sources": ["user","org","registry"] }
mcp__ren__mcp_get           { "id": "mcp_…" }
mcp__ren__mcp_oauth_connect { "id": "mcp_…" }
mcp__ren__mcp_oauth_session { "id": "mcp_…", "sessionId": "…" }
```

## Gotchas

- **Native integrations (Slack, GitHub) are not MCPs you connect here.** They're installed in the web app at `/app/settings/admin/integrations` (org owner/admin) and drive **webhook triggers**, not MCP tool calls. See [trigger-dev].
- Prefer a narrower hit (user/org) over a registry one when both match — it's usually an intentional override carrying domain knowledge.
- Don't author a custom MCP when an OAuth registry one already covers the surface.
