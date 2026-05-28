# MCP authConfig — env var derivation and shapes

Read when you're defining a custom MCP and need to know exactly where the credential will land in the outbound request, or what env-var name a paired credential must use.

## Env var name

When you define an MCP, the platform derives an env-var name from the MCP's slug + auth scheme:

| Auth scheme | Env var               |
| ----------- | --------------------- |
| `api_key`   | `MCP_<SLUG>_KEY`      |
| `basic`     | `MCP_<SLUG>_BASIC`    |
| `oauth`     | `MCP_<SLUG>_ACCESS_TOKEN` |

`<SLUG>` is the MCP's slug upper-cased with every non-alphanumeric character replaced by `_`. The credential you create later (in [[vaults-credentials-dev]]) must use this exact `name` — if it doesn't match, resolution misses and the env var is simply absent.

## authConfig shapes

The `authConfig` you set at create time decides **where** the secret value gets injected on each outbound MCP request. Pass one of:

### Header (most common)

```
{ "type": "api_key", "headerName": "Authorization", "prefix": "Bearer " }
```

`prefix` is optional — drop it if the provider wants the raw key.

### Query parameter

```
{ "type": "api_key", "queryParam": "api_key" }
```

### Basic auth

```
{ "type": "basic" }
```

The credential value should be the full `user:password` string; the runtime base64-encodes and prefixes with `Basic `.

### OAuth

```
{ "type": "oauth" }
```

Token lands in `Authorization: Bearer <token>`. The refresh flow is handled server-side; see [[vaults-credentials-dev]] for the connect / poll path.

## Updating the auth scheme

Changing `auth` or `authConfig` is a definition-level edit on the MCP, not a new version. Existing pods pick up the change on the next manifest refresh. If you also change the slug (by renaming the MCP), the derived env-var name changes too — re-create the credential under the new name.
