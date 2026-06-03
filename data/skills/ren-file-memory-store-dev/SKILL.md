---
name: ren-file-memory-store-dev
description: >-
  Create and attach file stores and memory stores - the durable volumes an agent
  reads from and writes to. Use when the user wants the agent to consume
  uploaded artifacts (file store, read-only) or keep long-term memory across
  runs (memory store, read-write).
---

# File & Memory Store Dev

Two volume types, both durable, both attach to a **project**:

- **File store** - **read-only** for the agent. Users upload artifacts (docs, datasets, reference material) so the agent has better context. The agent reads them; it can't write back.
- **Memory store** - **read-write** for the agent. Where the agent persists what it learns across sessions and runs: lessons from past conversations, user/team preferences and tastes, reusable decision-making frameworks.

## Runtime behavior

Once attached to a project, the store is available the next time the agent runs - no restart. The agent's prompt is told where to find it.

## Scope

Scoping follows the Ren standard - see [[ren-scope]]. Key constraint: a `user` store can only attach to a project in a user-private pod; an `org` store can attach to projects in any pod you own.

## Build via Ren CLI

Create the store (also `get` / `list` / `archive`):

```
ren file-stores   create --name "uploads"      --scope user --output json   # → fst_… (file store id)
ren memory-stores create --name "agent-memory" --scope user --output json   # → mst_… (memory store id)
```

## Build via Ren MCP

Same CRUD over the `{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__fileStore_create   { "query": { "scope": "user" }, "body": { "name": "uploads" } }
mcp__ren__memoryStore_create { "query": { "scope": "user" }, "body": { "name": "agent-memory" } }
```

## Uploading files (start → PUT → finalize)

Both store types use the **same three-step flow** and the same `files` subcommands. Per-file cap **50 MB**. Neither the CLI nor MCP transfers bytes for you - step 2 is a raw HTTP `PUT` you run yourself.

Step 1 `start-upload` returns `{ "url": "<presigned PUT target>", "expiresAt": "..." }` — the field is `url` (not `uploadUrl`), and there is no file id. Step 2 PUTs the raw bytes to that url (use the exact byte count from `--size`). Step 3 `finalize-upload` is keyed by `--path` only (the same path as step 1), no file id.

Worked example for a **memory store** via CLI (file stores are identical — swap `memory-stores`→`file-stores` and `mst_`→`fst_`):

```bash
ren memory-stores files start-upload <mst_…> --scope user --path "preferences.md" --size 1234 --output json
curl -X PUT --data-binary @preferences.md "<url-from-step-1>"
ren memory-stores files finalize-upload <mst_…> --scope user --path "preferences.md" --output json

ren memory-stores files list             <mst_…> --scope user --output json
ren memory-stores files presign-download <mst_…> --scope user --path "preferences.md" --output json
ren memory-stores files delete           <mst_…> --scope user --path "preferences.md"
```

Same flow via MCP (you still PUT the bytes to the returned `url` between the two calls):

```
mcp__ren__memoryStore_files_startUpload    { "query": { "scope": "user" }, "path": { "id": "mst_…" }, "body": { "path": "preferences.md", "size": 1234 } }
mcp__ren__memoryStore_files_finalizeUpload { "query": { "scope": "user" }, "path": { "id": "mst_…" }, "body": { "path": "preferences.md" } }
mcp__ren__memoryStore_files_list           { "query": { "scope": "user" }, "path": { "id": "mst_…" } }
```

Exact schema:

```
start-upload  body:     { path: string, size: int (bytes, ≤ 50 MB), contentType?: string }
start-upload  response: { url: string, expiresAt: ISO-8601 }   # no file id
finalize      body:     { path: string }                       # same path; no file id
```

## Attaching to a project

A store does nothing until it's attached to a project. Attachment is managed per-store (no atomic "set the list"):

```
ren projects file-stores   add <prj_…> --scope user --file-store-id   fst_…   # also: list / remove
ren projects memory-stores add <prj_…> --scope user --memory-store-id mst_…
```

```
mcp__ren__project_fileStore_add   { "query": { "scope": "user" }, "path": { "id": "prj_…" }, "body": { "fileStoreId":   "fst_…" } }
mcp__ren__project_memoryStore_add { "query": { "scope": "user" }, "path": { "id": "prj_…" }, "body": { "memoryStoreId": "mst_…" } }
```

**Attach is not idempotent - list before you add.** Re-attaching a store that's already on the project violates a unique constraint and surfaces as an ugly **500** (not a 400/409):

```
Failed query: insert into "project_memory_store" ... [500]
```

That specific 500 means *already attached* - treat it as success, don't retry. To avoid it, check first:

```
ren projects memory-stores list <prj_…> --scope user --output json   # is mst_… already there?
```

The project side (which agents see the store, how detaching propagates) lives in [[ren-project-dev]].

## Gotchas

- **Pick one scope - don't upload the same memories into both a user and an org store.** `--scope user` creates a *private* vault (`userId` set); `--scope org` creates a *shared* vault (`userId` null). They are distinct stores even with the same name. Onboarding a single user → use `user`. Seeding shared team memory → use `org`. Uploading the same files to both leaves two divergent copies that drift apart.
- Attaching a store is **not idempotent** - re-adding an attached store 500s with a `project_memory_store` duplicate error. See "Attaching to a project" above; list first.
- The same memory store attached to two projects is one piece of state: concurrent writers see each other's files.
- Don't attach empty stores speculatively.

## Next steps

- **Attach to a project** so the agent in it can read/write the store. See [[ren-project-dev]].
- **Tell the agent the store exists** - update its prompt to mention what's in the file store or what the memory store is for. See [[ren-agent-dev]].

