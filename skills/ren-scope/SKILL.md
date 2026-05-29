---

## name: ren-scope
description: Explains the three scope tiers (user, org, registry) for all Ren entities, their visibility rules, and how to use --scope / query.scope correctly. Load this whenever scope behavior is relevant.

# Ren Scope

Every Ren entity (agent, skill, MCP, credential, …) lives in one of three tiers:


| Tier         | Who sees it                | `--scope` flag               |
| ------------ | -------------------------- | ---------------------------- |
| **user**     | Only you (within your org) | `--scope user`               |
| **org**      | All org members            | omit (default)               |
| **registry** | Public; everyone           | publisher-created; read-only |


## Interaction rules

References only flow from narrower to broader:

- **user** can depend on entities in your own user scope, your org, and the registry — not another user's private entities.
- **org** can depend on entities in the same org and the registry — not user-private ones.
- **registry** can only depend on other registry entities — not org or user things.

An org-scoped agent cannot have a user-scoped skill as a dependency. A registry entity is fully self-contained.

## Using `--scope` / `query.scope`

Pass `--scope user` (CLI) / `"query": { "scope": "user" }` (MCP) when the entity lives in your user-private namespace. Omit it for org. `user` is the only valid value — never pass `--scope org` or `--scope registry`.

The flag applies to **every** command on an entity: create, get, update, versions. `search` is the exception — it uses `--sources user org registry` (multi-pick read filter) instead of `--scope`.

**If a valid entity ID 404s, a missing `--scope user` is the first thing to check.**