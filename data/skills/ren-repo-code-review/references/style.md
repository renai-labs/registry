# Style, tech debt, and local smells

Most of what follows is tech debt to surface, not optional nits. Scattered comments, missed reuse, wrong placement, KISS and YAGNI violations, and dead code all prevent rot, so raise all of it. Only the genuinely cosmetic or subjective items are capped nits. Do not relitigate what the formatter or linter already enforces. For each finding cite `file:line`, the rule, and a concrete fix; prefer a ```suggestion block.

## Comments (nitpick hard)
- Flag scattered comments aggressively. Every explanatory, narration, change-log, or WHY-restating comment, every TODO, every commented-out block, and stray debug logs should go. Comments explain WHY only, never WHAT. Keep a comment only when it is absolutely necessary to explain subtle, non-obvious behavior; delete the rest.

## Removals
- When the PR deletes a field, branch, flag, or behavior with no stated reason, ask whether it is intentional and what it meant. Silent removals hide regressions.

## Types and values
- No explicit `undefined` in code. Use conditional spread `...(cond && { x })` and default-value destructuring `const { limit = 50 } = filter`, not post-hoc `?? default`.
- No `!` non-null assertions and no `as` casts. Type the function properly instead.
- Types are derived, never hand-written: Drizzle to drizzle-zod to `z.infer`; DTOs and fixtures via `.pick`, `.omit`, `.extend`. Flag any hand-rolled type, DTO, or fixture that mirrors a schema. That is drift.
- Zod 4 idioms: `z.email()`, `z.url()`, never `z.string().email()`. Semantic, not lint-caught.

## Libraries over hand-rolling
- Use remeda for collection and object work (`R.filter(_, R.isTruthy)`, `R.pickBy`, `R.groupBy`), not manual `Object.entries().filter().map()` chains.
- No hand-rolled parsing, HTTP, or crypto where an official SDK or standard library exists. Flag it and name the library.
- No magic strings, regexes, or numbers. Constants at the top of the module.

## Simplicity and YAGNI
- Dumb, straight-line code over clever abstraction. Earn every helper, cache, alias, file split, or indirection with a reason that exists today.
- Flag dead props, state, params, tables, and "future use" code. Zero production callers means delete it, tests included.
- Flag defensive "just in case" branches and checks the platform already handles. Rely on good inputs.
- Root cause, not symptom: a fix guarded in one caller while its siblings route through the same broken function is incomplete. The guard belongs in the shared function.
- DRY has a floor: do not demand a shared abstraction for two call sites (rule of three). Flag duplication only for a genuine third consumer or real copy-paste. Never propose a wrapper that adds net lines with no clarity win.

## Failure and env
- Fail loudly: throw on invariant violations; no silent null or empty returns; no catch-and-rethrow; no `--no-verify`.
- Required product env is `z.string().min(1)` (fail fast at import), not `optional()` plus a runtime enabled flag. Env is validated per module at import, never read inline.

## Naming and placement
- Intention-revealing names; descriptive over terse (`commaSeparatedValidator`, not `csv`). Qualify shared nouns (`agentVersionIds`, not `versionIds`); name maps `<value>By<key>` (`inputsByProjectId`).
- `get*` throws on missing; `find*` returns nullable. Singular module and entity names; namespaces over classes for stateless groupings.
- Code lives in the right module. Flag logic that belongs in a sibling domain, `util/`, or the shared engine. Thin routes; domain logic outside `server/`.

## Backend and frontend specifics
- Backend: domain modules `src/<domain>/{schema.ts,index.ts}`; auth and ownership via `server/guards.ts` plus pod-membership, never ad-hoc in routes or services. Probe every route for scope leaks: cross-user, cross-org, or non-member reach.
- Frontend: reuse `@ren/ui` and existing hooks before adding a component; memoize hook returns (a fresh object every render breaks consumer `useEffect` deps); never `setState` synchronously in `useEffect`; always clean up timers and subscriptions; validate redirect params at the schema.

## Security
- Never leak secrets or API keys into the sandbox; treat it as hostile. Never print, log, or expose env values.

## Observability
- New calls to an external service, and API error paths, should emit tracing through the `Trace` facade (`Trace.span` at the boundary, error capture), never the OTel SDK directly. Span and operation names must be bounded: collapse id-bearing path segments to `:id`, put ids in attributes. Flag a new integration or error path that lands with no instrumentation - that is where we go blind in PostHog.
