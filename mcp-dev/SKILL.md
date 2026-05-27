---
name: mcp-dev
description: Discover and define MCP servers - the third-party tool surfaces an agent can call (Linear, Gmail, GitHub, …). Use when an agent needs an external tool: reach for Ren's registry MCPs first, and register a custom remote MCP only when nothing fits.
---

# MCP Dev

## What an MCP is - and what it means on Ren

MCP (Model Context Protocol) is the open standard for exposing a tool surface to an agent: a server publishes tools, the agent calls them. Linear, Gmail, GitHub, Notion, and many SaaS APIs have MCP servers they officially host for consumers to connect to.

On Ren an MCP is a first-class entity (user / org / registry scope) that an agent references by id - `mcps: [{ mcpId }]` on the **agent version**. The agent calls its tools; the platform handles the connection and slots in credentials at runtime, so the agent never touches a secret. Ren offers many MCPs out of the box in its registry, and also offers the ability to setup custom remote-mcps for users and orgs. 


## Reach for Ren's registry MCPs first

Ren ships a public registry of MCPs that are **tested and production-ready** - the server URL, transport, and auth config are already correct. Always prefer a registry MCP over rolling your own: a custom MCP is unmaintained surface you now own. Search before you build.

**Not every product exposes an MCP server.** If the registry has no fit and a web search turns up no official MCP hosted by the third party, the fallback is an **API-key-backed skill** ([skill-dev]): a skill that calls the product's HTTP API directly, with the API key declared in its `requiredCredentials`.

### Search Via Ren CLI

```
ren mcps search --query "<topic>" --sources user org registry --output json
ren mcps get        <mcp-id> --output json
ren mcps get-by-slug <slug>  --output json
```

### Search Via Ren MCP

```
mcp__ren__mcp_search    { "body":  { "query": "<topic>", "sources": ["user","org","registry"] } }
mcp__ren__mcp_get       { "path":  { "id": "mcp_…" } }
mcp__ren__mcp_getBySlug { "path":  { "slug": "<slug>" } }
```

`--sources` (CLI) / `sources` (MCP) picks **which scope tiers** the search returns (default all three):

- **`registry`** — public, Ren-maintained. Usable anywhere: by any user's agents and any org's agents.
- **`org`** — owned by your org, shared across its members. Usable by that org's agents.
- **`user`** —  Usable by your own agents, including when you build at the org level.

Scope flows one way — narrower into broader. A `user` MCP can back an `org` agent and a `registry` MCP can back anything, but not the reverse: an `org` MCP can't be pulled into another org, and nothing private can back a published registry entity.

## Nuances to know before building

How an attached MCP actually runs - worth knowing before you define one:

- **It's a remote HTTP server.** At sandbox compose time every attached MCP becomes `{ type: "remote", url: <mcpServerUrl> }` in the agent's opencode config, so a custom MCP needs a real, reachable `mcpServerUrl` - an MCP without one is dropped.
- **The secret arrives as an env var, interpolated into the request.** The credential resolved from the pod's vault lands in the sandbox env as `MCP_<SLUG>_KEY` (api_key), `MCP_<SLUG>_BASIC` (basic), or `MCP_<SLUG>_ACCESS_TOKEN` (oauth) - `<SLUG>` is the slug upper-cased with non-alphanumerics → `_`. opencode interpolates it into the live request per the MCP's `authConfig`: an `Authorization`/custom header, a URL query param, or basic auth. So the `authConfig` you set at build time is exactly what decides where the secret goes.
- **Defining an MCP ≠ authorizing it.** `authConfig` only declares *how* a secret is presented; it carries no secret. Wiring the actual credential is a separate step (see Next steps).

## Build a custom MCP

Only when the registry has nothing in the neighborhood. `--name` and `--mcp-server-url` (a URL) are required; `authConfig` is nested, so pass it via `--body`.

### Via CLI

```
ren mcps create \
  --name "Acme API" \
  --mcp-server-url "https://mcp.acme.com" \
  --auth api_key \
  --scope user \
  --body '{ "authConfig": { "type": "api_key", "headerName": "Authorization" } }'
```

- `--auth` is one of `none | oauth | api_key | basic` (default `none`).
- `--scope` sets the **namespace the new MCP lands in**: `user` (private to you) or `org` (team-shared). It **defaults to `org`** - pass `--scope user` for a private build. (This is the create-time namespace; `--sources` above is the read-time filter - different flags, different jobs.)
- The slug is generated from the name; that slug drives the `MCP_<SLUG>_*` env var the credential must match.

### Via MCP

```
mcp__ren__mcp_create {
  "query": { "scope": "user" },
  "body":  { "name": "Acme API", "mcpServerUrl": "https://mcp.acme.com",
             "auth": "api_key", "authConfig": { "type": "api_key", "headerName": "Authorization" } }
}
```

Over MCP, `scope` lives under `query` and its only value is `"user"` - omit it for the `org` default. (The CLI's `--scope org` is just the absent case.)

## Next steps

- **Attach it to an agent** - add the id to the agent version's `mcps: [{ mcpId }]` list. See [agent-dev].
- **Authorize it** - get the credential into the pod's vault (OAuth connect or API key) so the `MCP_<SLUG>_`* env var resolves at startup. See [credentials-dev].

