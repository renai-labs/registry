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

- **File store** — **read-only** for the agent. Users upload artifacts (docs, datasets, reference material) so the agent has better context. The agent reads them; it can't write back.
- **Memory store** — **read-write** for the agent. Where the agent persists what it learns across sessions and runs: lessons from past conversations, user/team preferences and tastes, reusable decision-making frameworks.

## Runtime behavior

Once attached to a project, the store is available the next time the agent runs — no restart. The agent's prompt is told where to find it.

## Scope

Scoping follows the Ren standard — see [[ren-scope]]. Key constraint: a `user` store can only attach to a project in a user-private pod; an `org` store can attach to projects in any pod you own.

## Build via Ren CLI

```
ren file-stores   create --name "uploads"      --scope user --output json   # → fst_… (file store id)
ren memory-stores create --name "agent-memory" --scope user --output json   # → mst_… (memory store id)
```

Seed a file store with an artifact the agent should read (multi-step: start → PUT → finalize; per-file cap **50 MB**):

```
ren file-stores files start-upload <fst_…> --scope user --path "report.pdf" --size 20480 --output json  # → presigned PUT target
# PUT the bytes to the returned target, then:
ren file-stores files finalize-upload  <fst_…> --scope user --path "report.pdf" --output json
ren file-stores files list             <fst_…> --scope user --output json
ren file-stores files presign-download <fst_…> --scope user --path "report.pdf" --output json
ren file-stores files delete           <fst_…> --scope user --path "report.pdf"
```

Memory stores expose the same `files` subcommands — useful to migrate prior memories in from another system. Day-to-day the agent writes to the memory store directly.

## Build via Ren MCP

`{ path, query, body }` envelope (params are the API field names):

```
mcp__ren__fileStore_create               { "query": { "scope": "user" }, "body": { "name": "uploads" } }
mcp__ren__memoryStore_create             { "query": { "scope": "user" }, "body": { "name": "agent-memory" } }
mcp__ren__fileStore_files_startUpload    { "query": { "scope": "user" }, "path": { "id": "fst_…" }, "body": { "path": "report.pdf", "size": 20480 } }
mcp__ren__fileStore_files_finalizeUpload { "query": { "scope": "user" }, "path": { "id": "fst_…" }, "body": { "path": "report.pdf" } }
mcp__ren__fileStore_files_list           { "query": { "scope": "user" }, "path": { "id": "fst_…" } }
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

The project side (which agents see the store, how detaching propagates) lives in [[ren-project-dev]].

## Gotchas

- The same memory store attached to two projects is one piece of state: concurrent writers see each other's files.
- Don't attach empty stores speculatively.

## Next steps

- **Attach to a project** so the agent in it can read/write the store. See [[ren-project-dev]].
- **Tell the agent the store exists** — update its prompt to mention what's in the file store or what the memory store is for. See [[ren-agent-dev]].
