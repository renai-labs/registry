---
name: file-memory-store-dev
description: Create and attach file stores and memory stores - the S3-backed FUSE volumes an agent reads from and writes to. Use when the user wants the agent to consume uploaded artifacts (file store, read-only) or keep long-term memory across runs (memory store, read-write).
---

# File & Memory Store Dev

Two volume types, both S3-backed, both attach to a **project**:

- **File store** - **read-only** for the agent. Users upload artifacts here (docs, datasets, reference material) so the agent has better context for its work. The agent reads them; it can't write back.
- **Memory store** - **read-write** for the agent. Where the agent persists what it learns across sessions and runs: lessons from past conversations, user and team preferences and tastes, and reusable decision-making frameworks it can pull into future work.

## Lifecycle in the manifested sandbox

When a store is attached to a project, the manifest mounts it into the pod sandbox as a **FUSE volume** (AWS `mount-s3`) under `/volumes/`:

- **File store → `/volumes/<mountSlug>`, mounted read-only (`ro`).** Fallback path `/volumes/fs-<last6-of-id>` when no slug is set.
- **Memory store → `/volumes/<mountSlug>`, mounted read-write (`rw`).** Fallback `/volumes/ms-<last6-of-id>`.

Because the mount is FUSE-over-S3 (the bucket + prefix *is* the volume), the contents stay in sync across every sandbox the store is mounted in — a write in one sandbox lands in S3 and is visible wherever else that store is attached. There's no per-sandbox copy to reconcile. `mountSlug` is derived from the store name at create time and is unique per org.

(The pod-wide volume is separate - it mounts at `/home/user/artifacts`. Stores live under `/volumes/`.)

The agent's system prompt is told the mounted volume paths at compose time, so it knows where to read and write. Attaching or detaching a store bumps the pod manifest and fans out - no restart.

## Build via CLI

```
ren file-stores   create --name "uploads"      --output json   # → fst_… (file store id)
ren memory-stores create --name "agent-memory" --output json   # → mst_… (memory store id)
```

Seed a file store with an artifact the agent should read (multi-step: start → PUT → finalize):

```
ren file-stores files start-upload <fst_…> --path "report.pdf" --size 20480 --output json  # → presigned PUT target
# PUT the bytes to the returned target, then:
ren file-stores files finalize-upload  <fst_…> --path "report.pdf" --output json
ren file-stores files list             <fst_…> --output json
ren file-stores files presign-download <fst_…> --path "report.pdf" --output json
ren file-stores files delete           <fst_…> --path "report.pdf"
```

Memory stores expose the same `files` subcommands (`start-upload` / `finalize-upload` / `list` / `presign-download` / `delete`) — useful to migrate prior memories in from another system. Day-to-day the agent just writes to the `rw` mount directly.

## Build via MCP

```
mcp__ren__fileStore_create   { "name": "uploads" }
mcp__ren__memoryStore_create { "name": "agent-memory" }
mcp__ren__fileStore_files_startUpload    { "id": "fst_…", "path": "report.pdf", "size": 20480 }
mcp__ren__fileStore_files_finalizeUpload { "id": "fst_…", "path": "report.pdf" }
mcp__ren__fileStore_files_list           { "id": "fst_…" }
```

## Attaching to a project

A store does nothing until it's attached to a project — that's what puts it in the pod manifest and mounts it into the sandbox. Attachment is managed per-store (no atomic "set the list"):

```
ren projects file-stores   add <prj_…> --file-store-id   fst_…   # also: list / remove
ren projects memory-stores add <prj_…> --memory-store-id mst_…   # also: list / remove
```

```
mcp__ren__project_fileStore_add   { "id": "prj_…", "fileStoreId": "fst_…" }
mcp__ren__project_memoryStore_add { "id": "prj_…", "memoryStoreId": "mst_…" }
```

The project side (which agents get the mounts, how detaching fans out) lives in [project-dev].

## Gotchas

- File store is **read-only** in the sandbox — the agent can't write back into it. Use a memory store (`rw`) for anything the agent must persist.
- Reach for a store when the user wants to **upload artifacts the agent needs** (file store) or have the agent **remember across runs** (memory store). Don't attach empty stores speculatively.
- The FUSE mount means stores are shared, not copied: the same memory store attached to two projects/sandboxes is one S3 prefix — concurrent writers see each other's files.
