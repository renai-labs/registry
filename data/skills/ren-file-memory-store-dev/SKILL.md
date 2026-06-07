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

> Commands and flags (`file-stores` / `memory-stores` create/get/list/archive, the `files` subcommands, `projects … add`): `ren docs commands`. Scope: `ren docs model`. This skill is the upload flow and the attach gotchas. Once attached, a store is available the next time the agent runs (no restart) and the agent's prompt is told where to find it.

## Uploading files (start → PUT → finalize)

Both store types use the **same three-step flow** and the same `files` subcommands. Per-file cap **50 MB**. Neither the CLI nor MCP transfers bytes for you - step 2 is a raw HTTP `PUT` you run yourself.

Step 1 `start-upload` returns `{ "url": "<presigned PUT target>", "expiresAt": "..." }` — the field is `url` (not `uploadUrl`), and there is no file id. Step 2 PUTs the raw bytes to that url (use the exact byte count from `--size`). Step 3 `finalize-upload` is keyed by `--path` only (the same path as step 1), no file id.

Worked example for a **memory store** via CLI (file stores are identical — swap `memory-stores`→`file-stores` and `mst_`→`fst_`):

```bash
ren memory-stores files start-upload <mst_…> --scope user --path "preferences.md" --size 1234 --output json
curl -X PUT --data-binary @preferences.md "<url-from-step-1>"
ren memory-stores files finalize-upload <mst_…> --scope user --path "preferences.md" --output json
```

Via MCP you still PUT the bytes to the returned `url` between the `startUpload` and `finalizeUpload` calls. Exact schema:

```
start-upload  body:     { path: string, size: int (bytes, ≤ 50 MB), contentType?: string }
start-upload  response: { url: string, expiresAt: ISO-8601 }   # no file id
finalize      body:     { path: string }                       # same path; no file id
```

## Attaching to a project

A store does nothing until it's attached to a project. **Attach is not idempotent - list before you add.** Re-attaching a store that's already on the project violates a unique constraint and surfaces as an ugly **500** (not a 400/409):

```
Failed query: insert into "project_memory_store" ... [500]
```

That specific 500 means *already attached* - treat it as success, don't retry. To avoid it, `ren projects memory-stores list <prj_…>` first and only add if it's not already there.

## Gotchas

- **Pick one scope - don't upload the same memories into both a user and an org store.** `--scope user` creates a *private* store (`userId` set); `--scope org` creates a *shared* one (`userId` null). They are distinct stores even with the same name. Onboarding a single user → `user`. Seeding shared team memory → `org`. Uploading the same files to both leaves two divergent copies that drift apart.
- Attaching a store is **not idempotent** - re-adding an attached store 500s with a `project_*_store` duplicate error. List first.
- The same memory store attached to two projects is one piece of state: concurrent writers see each other's files.
- Don't attach empty stores speculatively.

## Next steps

- **Attach to a project** so the agent in it can read/write the store. See [[ren-project-dev]].
- **Tell the agent the store exists** - update its prompt to mention what's in the file store or what the memory store is for. See [[ren-agent-dev]].
