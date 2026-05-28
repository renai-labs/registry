---
name: mcp-dev
description: Discover and define MCP servers - the third-party tool surfaces an agent can call (Linear, Gmail, GitHub, …). Use when an agent needs an external tool: reach for Ren's registry MCPs first, and register a custom remote MCP only when nothing fits.
---

# MCP Dev

## What an MCP is - and what it means on Ren

MCP (Model Context Protocol) is the open standard for exposing a tool surface to an agent: a server publishes tools, the agent calls them. Linear, Gmail, GitHub, Notion, and many SaaS APIs have MCP servers they officially host for consumers to connect to.

On Ren an MCP is a first-class entity (user / org / registry scope) that an agent references by id - `mcps: [{ mcpId }]` on the agent version. The agent calls its tools; the platform handles the connection and slots in credentials at runtime, so the agent never touches a secret. Ren offers many MCPs out of the box in its registry, and also lets users/orgs register custom remote MCPs.

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

`<SLUG>` is the MCP's slug upper-cased with every non-alphanumeric replaced by `_`. `authConfig` decides where that value lands on each outbound request: `{ type: "api_key", headerName: "Authorization", prefix: "Bearer " }` (header), `{ type: "api_key", queryParam: "api_key" }` (query), `{ type: "basic" }` (raw `user:password`, runtime base64-encodes), or `{ type: "oauth" }` (Bearer; refresh handled server-side, see [[vaults-credentials-dev]]).

## Reach for Ren's registry MCPs first

Ren ships a public registry of MCPs that are **tested and production-ready** - the server URL, transport, and auth config are already correct. Always prefer a registry MCP over rolling your own: a custom MCP is unmaintained surface you now own. Search before you build.

**Not every product exposes an MCP server.** If the registry has no fit and a web search turns up no official MCP hosted by the third party, the fallback is an **API-key-backed skill** ([[skill-dev]]): a skill that calls the product's HTTP API directly, with the API key declared in its `requiredCredentials`.

### Search via Ren CLI

```
ren mcps search --query "<topic>" --sources user org registry --output json
ren mcps get        <mcp-id> --output json
ren mcps get-by-slug <slug>  --output json
```

### Search via Ren MCP

```
mcp__ren__mcp_search    { "body":  { "query": "<topic>", "sources": ["user","org","registry"] } }
mcp__ren__mcp_get       { "path":  { "id": "mcp_…" } }
mcp__ren__mcp_getBySlug { "path":  { "slug": "<slug>" } }
```

## Scope

Two related concepts — keep them straight:

- **`--sources` / `sources`** is the **read-time filter** on search: which tiers come back. Defaults to all three.
- **`--scope` / `query.scope`** is the **create-time namespace** the new MCP lands in. Defaults to **`org`** (team-shared). Pass `--scope user` for a private MCP.

The scope tiers:

- **`registry`** — public, Ren-maintained. Usable by any user's or org's agents.
- **`org`** — owned by your org, shared across its members.
- **`user`** — private to you. Usable by your own agents, including when you build at the org level.

Scope flows one way — narrower into broader. A `user` MCP can back an `org` agent and a `registry` MCP can back anything, but not the reverse: an `org` MCP can't be pulled into another org, and nothing private can back a published registry entity.

## Build a custom MCP

Only when the registry has nothing in the neighborhood. `--name` and `--mcp-server-url` (a URL) are required; `authConfig` is nested, so pass it via `--body`.

### Via Ren CLI

```
ren mcps create \
  --name "Acme API" \
  --mcp-server-url "https://mcp.acme.com" \
  --auth api_key \
  --scope user \
  --body '{ "authConfig": { "type": "api_key", "headerName": "Authorization" } }'
```

- `--auth` is one of `none | oauth | api_key | basic` (default `none`).
- `--scope` defaults to `org` — pass `--scope user` for a private build.
- The slug is generated from the name; the slug drives the env-var name the credential must match (see Runtime behavior above).

### Via Ren MCP

```
mcp__ren__mcp_create {
  "query": { "scope": "user" },
  "body":  { "name": "Acme API", "mcpServerUrl": "https://mcp.acme.com",
             "auth": "api_key", "authConfig": { "type": "api_key", "headerName": "Authorization" } }
}
```

Over MCP, `scope` lives under `query` and its only value is `"user"` - omit it for the `org` default.

## Next steps

An MCP does nothing until an agent uses it and the credential is wired.

- **Attach to an agent** — add the id to the agent version's `mcps: [{ mcpId }]` list. See [[agent-dev]].
- **Authorize it** — OAuth (`ren mcps oauths connect <mcp-id>` runs the consent flow and resolves the default vault automatically) or API key (a credential in a vault). See [[vaults-credentials-dev]].
- **Put the agent in a project** so a session can actually call the MCP's tools. See [[project-dev]].
