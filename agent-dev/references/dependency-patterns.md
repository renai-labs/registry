# Dependency Patterns

## Permissions

Each rule: `{ permission: "tool", pattern: string, action: "allow" | "deny" | "ask" }`.

`pattern` is a glob matched against the tool name — `*` matches any sequence of characters. Rules are evaluated in order; first match wins.

Always end with a catch-all `*` deny to enforce an allow-list, or a catch-all `*` allow to restrict only specific tools.

## Anti-patterns

- **Over-attaching.** More skills ≠ better agent. Three focused skills beats ten loose ones.
- **Skipping a deny catch-all.** A write-capable MCP without one is a foot-gun.
- **Per-call permission tweaks.** If you're toggling rules often, the wrong dep is attached.
