---
name: store-dev
description: Create and attach file stores and memory stores — the S3-backed volumes an agent reads, writes, and remembers across runs. Use when the user wants the agent to take uploads, produce file outputs, or keep long-term memory.
---

# Store Dev

Two volume types, both S3-backed, both attach to a **project**:

- **File store** — user artifacts the agent works with (uploads in, generated outputs out).
- **Memory store** — the agent's long-term memory as JSON docs, persisted across sessions and runs.

## Lifecycle in the manifested sandbox

When a store is attached to a project, the manifest mounts it into the pod sandbox as a volume:

- **File store → `/volumes/<mountSlug>`, mounted read-only (`ro`).** Fallback path `/volumes/fs-<last6-of-id>` when no slug is set.
- **Memory store → `/volumes/<mountSlug>`, mounted read-write (`rw`).** Fallback `/volumes/ms-<last6-of-id>`.

(The pod-wide volume is separate — it mounts at `/home/user/artifacts`. Stores live under `/volumes/`.)

The agent's system prompt is told the mounted volume paths at compose time, so it knows where to read and write. Attaching or detaching a store bumps the pod manifest and fans out — no restart.

## Build via CLI

```
ren file-stores create   --name "uploads"  --output json     # → fileStoreId
ren memory-stores create --name "agent-memory" --output json  # → memoryStoreId

# attach to the project (see project-dev for the project side)
ren projects file-stores   add <project-id> --file-store-id   fst_…
ren projects memory-stores add <project-id> --memory-store-id mst_…
```

Upload a file the agent should read (multi-step: start → finalize):

```
ren file-stores files start-upload    <file-store-id> --output json   # → upload target + fileId
# PUT the bytes to the returned target, then:
ren file-stores files finalize-upload <file-store-id> --output json
ren file-stores files list            <file-store-id> --output json
ren file-stores files presign-download <file-store-id> --output json
```

## Build via MCP

```
mcp__ren__fileStore_create   { "name": "uploads" }
mcp__ren__memoryStore_create { "name": "agent-memory" }
mcp__ren__project_fileStore_add   { "id": "prj_…", "fileStoreId": "fst_…" }
mcp__ren__project_memoryStore_add { "id": "prj_…", "memoryStoreId": "mst_…" }
mcp__ren__fileStore_files_startUpload    { "id": "fst_…" }
mcp__ren__fileStore_files_finalizeUpload { "id": "fst_…", … }
```

## Gotchas

- File store is **read-only** in the sandbox — the agent can't write back into it. Use a memory store (rw) for anything the agent must persist.
- Reach for stores when the user wants to **upload a file the agent needs** or **migrate prior memories** from another system into Ren. Don't attach empty stores speculatively.
- Memory store holds JSON docs, not free text — it's the agent's structured memory, distinct from a host's conversational memory.
