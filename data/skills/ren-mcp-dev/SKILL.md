---
name: ren-mcp-dev
description: >-
  Discover and define MCP servers - the third-party tool surfaces an agent can
  call (Linear, Gmail, GitHub, …). Use when an agent needs an external tool:
  reach for Ren's registry MCPs first, and register a custom remote MCP only
  when nothing fits.
---

# MCP Dev

## What an MCP is

An MCP (Model Context Protocol server) is a standardized interface for giving agents access to external tools and services — databases, APIs, internal systems, or any custom capability you want to expose.

## Runtime behavior

- **It's a remote HTTP server.** A custom MCP needs a real, reachable `mcpServerUrl` — one without it is dropped at compose time and the agent simply won't see its tools.
- **Defining an MCP ≠ authorizing it.** `authConfig` only declares **how** a secret is presented (which header / query param / basic-auth slot). It carries no secret. Wiring the actual credential is a separate step (see Next steps).
- **Attaching to an agent makes its tools available** the next time a session opens — no restart. Definition-level edits (URL, `authConfig`) propagate on the next manifest refresh.

The credential a paired vault entry creates must use the env-var name Ren derives from the MCP's slug:

| `auth`     | Env var                   |
| ---------- | ------------------------- |
| `api_key`  | `MCP_<SLUG>_KEY`          |
| `basic`    | `MCP_<SLUG>_BASIC`        |
| `oauth`    | `MCP_<SLUG>_ACCESS_TOKEN` |

`<SLUG>` is the MCP's slug upper-cased with every non-alphanumeric replaced by `_`. `authConfig` decides where that value lands on each outbound request: `{ type: "api_key", headerName: "Authorization", prefix: "Bearer " }` (header), `{ type: "api_key", queryParam: "api_key" }` (query), `{ type: "basic" }` (raw `user:password`, runtime base64-encodes), or `{ type: "oauth" }` (Bearer; refresh handled server-side, see [[ren-vaults-credentials-dev]]).

## Reach for Ren's registry MCPs first

Ren ships a public registry of MCPs that are **tested and production-ready** - the server URL, transport, and auth config are already correct. Always prefer a registry MCP over rolling your own: a custom MCP is unmaintained surface you now own. Search before you build.

**Not every product exposes an MCP server.** If the registry has no fit and a web search turns up no official MCP hosted by the third party, the fallback is an **API-key-backed skill** ([[ren-skill-dev]]): a skill that calls the product's HTTP API directly, with the API key declared in its `requiredCredentials`.

## Validate Ren compatibility

Before attaching a custom MCP, run the validator script

```
./scripts/validate-mcp.js https://mcp.acme.com/mcp           # public server
./scripts/validate-mcp.js https://mcp.acme.com/mcp --auth oauth   # protected: discovery-only
./scripts/validate-mcp.js https://mcp.acme.com/mcp --token "$TOKEN"   # list tools through the auth wall
./scripts/validate-mcp.js --help                             # drift checks, --json, all options
```

## Next steps

An MCP does nothing until an agent uses it and the credential is wired.

- **Attach to an agent** — add the id to the agent version's `mcps: [{ mcpId }]` list. See [[ren-agent-dev]].
- **Authorize it** — OAuth (`ren mcps oauths connect <mcp-id>` runs the consent flow and resolves the default vault automatically) or API key (a credential in a vault). See [[ren-vaults-credentials-dev]].
- **Put the agent in a project** so a session can actually call the MCP's tools. See [[ren-project-dev]].
