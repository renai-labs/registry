# Dependency Patterns

## Anti-patterns

- **Over-attaching.** More skills ≠ better agent. Three focused skills beats ten loose ones.
- **Stale dep lists.** `ren_agent_save` replaces the full `skills` / `mcps` list. Always `ren_agent_get` first, merge, then save.
- **Mixing concerns in one skill.** If a skill grows two unrelated workflows, split it. Attaching one focused skill beats attaching a sprawling one.
