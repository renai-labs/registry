---
name: ren-mcp-dev
description: >-
  Define a custom remote MCP server - the third-party tool surface an agent can
  call - for when no registry MCP fits. Use to shape a custom remote MCP's
  server URL and auth-config and validate its Ren compatibility.
---

# MCP Dev

An MCP server is a remote tool surface an agent can call. This skill is the **craft of defining a custom remote MCP** — its server URL, the `authConfig` shape, and validating Ren compatibility. The architect routes you here only when no registry MCP fits; reuse/search, create/update, OAuth, attaching, and scope all live in [[ren-systems-architect]].

## What a custom MCP definition needs

- **It's a remote HTTP server.** A custom MCP needs a real, reachable `mcpServerUrl` — one without it is dropped at compose time and the agent simply won't see its tools.
- **Defining an MCP ≠ authorizing it.** `authConfig` only declares **how** a secret is presented (which header / query param / basic-auth slot). It carries no secret — wiring the actual credential is a separate step ([[ren-vaults-credentials-dev]]).
- **Attaching to an agent makes its tools available** the next time a session opens — no restart. Definition-level edits (URL, `authConfig`) propagate on the next manifest refresh.

## Auth-config shape

The credential a paired vault entry creates must use the env-var name Ren derives from the MCP's slug:

| `auth`     | Env var                   |
| ---------- | ------------------------- |
| `api_key`  | `MCP_<SLUG>_KEY`          |
| `basic`    | `MCP_<SLUG>_BASIC`        |
| `oauth`    | `MCP_<SLUG>_ACCESS_TOKEN` |

`<SLUG>` is the MCP's slug upper-cased with every non-alphanumeric replaced by `_`. `authConfig` decides where that value lands on each outbound request: `{ type: "api_key", headerName: "Authorization", prefix: "Bearer " }` (header), `{ type: "api_key", queryParam: "api_key" }` (query), `{ type: "basic" }` (raw `user:password`, runtime base64-encodes), or `{ type: "oauth" }` (Bearer; refresh handled server-side, see [[ren-vaults-credentials-dev]]). `authConfig` is nested.

## When no registry MCP fits — the fallback

A custom MCP is unmaintained surface you now own, so it's the last resort. **Not every product exposes an MCP server.** If the registry has no fit and a web search turns up no official MCP hosted by the third party, the fallback is an **API-key-backed skill** ([[ren-skill-dev]]): a skill that calls the product's HTTP API directly, with the API key declared in its `requiredCredentials`.

## Validate Ren compatibility

Before a custom MCP is attached, run the validator script:

```
./scripts/validate-mcp.js https://mcp.acme.com/mcp           # public server
./scripts/validate-mcp.js https://mcp.acme.com/mcp --auth oauth   # protected: discovery-only
./scripts/validate-mcp.js https://mcp.acme.com/mcp --token "$TOKEN"   # list tools through the auth wall
./scripts/validate-mcp.js --help                             # drift checks, --json, all options
```

For the registry-reuse path, the create / update commands, OAuth authorization, and attaching to an agent — all Ren operations — see [[ren-systems-architect]].
