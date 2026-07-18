# Architecture and product-call conformance (blocking when violated)

Style is nits. Violating a documented decision or invariant is blocking. This repo writes those decisions down, so use them; it is the advantage a veteran on this team has over a diff-only reviewer.

## Read the map before you comment

For each changed file, read the nearest `CLAUDE.md` (walk up the directory tree) and, when the change touches those mechanics, its `docs/` siblings and any `## Cross-links`. Load only what the diff touches; this is scoped by the changed files, not the whole repo. Do not copy these docs anywhere. Read them live from the checkout, because they are the always-current source of truth.

## Check the change against these sections

- `## Gotchas`: did the change trip a documented footgun? Examples: awaiting a `touchManifest` that must stay best-effort; breaking a loop guard; assuming multi-install support; collapsing the ephemeral-sandbox vs durable-session split.
- `## Product calls`: does it contradict a deliberate decision? Examples: tokens minted just-in-time and never persisted; reply-via-tool rather than assistant text; sender authz is pod membership.
- `## Cross-module dependencies` / `## Data flow`: does a change here have downstream effects the PR did not handle? Manifest fanout, teardown cascade, provisioning order.
- `## Schema`: unique keys, cascade vs set-null, "metadata only, never a token", and version pin-vs-latest (WYSIWYG) invariants.

Treat a violation of a product call, gotcha, or schema invariant as blocking, and cite the doc (for example, `github/CLAUDE.md` Product calls: tokens minted just-in-time).

## Keep the docs from going stale (required check)

The internal docs are only useful while they match the code. On every review, if the PR changes mechanics that a `CLAUDE.md` or `docs/*.md` describes and does not update that doc in the same PR, flag it as blocking and name the doc and section that is now wrong. This includes a new gotcha, a changed product call, a renamed field or table, or a moved responsibility. A stale map is the drift this team rejects, so treat doc updates as part of the change, not optional follow-up.

## CLAUDE.md is authoritative but fallible

Cite it, but reason from the code when they conflict; the docs occasionally note their own staleness. When they disagree, say so and go with the code (and flag the doc per the section above).
