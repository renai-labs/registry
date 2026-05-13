# Dependency Patterns

## Anti-patterns

- **Over-attaching.** More skills ≠ better agent. Three focused skills beats ten loose ones.
- **Stale dep lists.** `ren_agent_upsert` replaces the full `skillIds` / `mcpIds` lists when you pass them. Always `ren_agent_get` first, merge the id array, then upsert.
- **Mixing concerns in one skill.** If a skill grows two unrelated workflows, split it. Attaching one focused skill beats attaching a sprawling one.
