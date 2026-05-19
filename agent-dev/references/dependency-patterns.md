# Dependency Patterns

## Anti-patterns

- **Over-attaching.** More skills ≠ better agent. Three focused skills beats ten loose ones.
- **Stale dep lists.** `ren agents versions create` replaces the full `skillIds` / `mcpIds` lists when you pass them. Always `ren agents get` first, merge the id array, then ship the new version.
- **Mixing concerns in one skill.** If a skill grows two unrelated workflows, split it. Attaching one focused skill beats attaching a sprawling one.
