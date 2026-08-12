# Artifacts

An artifact is a React project on the pod at `/home/user/artifacts/<slug>/` whose `build/` folder is
served at a share URL. The project survives sandbox recycles, so a later session edits and rebuilds
the same page.

**How to build one is in the `ren-artifact` skill** — scaffolding, the data contract, theming,
components, troubleshooting. It is a system skill, so every agent in every project already carries
it; load it when you build. This file covers the rest: when to reach for a page, who builds it, how
it stays fresh, and what to tell the user when you hand over the link.

## When it's the right answer

Reach for an artifact when the output is something to **look at**, not read once:

- a table or comparison longer than a few rows,
- anything with a chart in it,
- a recurring report — the same shape, over and over,
- something the user will re-open later, or show someone else.

Use `show_file` instead when they want a file to download; the two are not interchangeable. Stay in
chat when the answer is a sentence.

**Offer one when the output has the shape of a page**, the same way you offer a schedule. You just
produced a forty-row table in a message, or you are about to produce the same summary next week — say
so and offer the page. One offer, after you have delivered, and drop it if they say no.

## Who builds it

Follow the data:

- **You hold the data** — it's in a pod database, a store, or something you can query — build it
  yourself. Load `ren-artifact` and scaffold.
- **Another agent holds the integration** — task it as a subagent. It carries `ren-artifact` too, and
  the artifacts directory is pod-wide rather than project-scoped, so any agent in the pod can build
  and sync one. You stay in the conversation and hand over the URL yourself.

Artifacts belong to the **pod**, not a project — the same rung as the pod databases they read.
`ren artifacts list` from inside the sandbox shows what the pod already has.

## The two shapes

**With data.** The canonical wiring, and the reason pod databases exist:

```
skill or agent writes rows  →  pod database  →  sync-data.ts  →  build/data.json  →  the page fetches it
```

Data is not compiled into the page. Refreshing the numbers is `bun run sync-data` — no rebuild, no
code change, and **the URL never changes**.

**Without data.** A written report, a comparison, a decision record, a one-page brief. No database, no
`sync-data.ts`, no refresh — just a page at a URL. Most one-off artifacts are this. Don't invent a
database for content that has none.

## Keeping it fresh

There is no scheduled sync inside the platform. A refresh is an agent run like any other: a cron fires
the agent that owns the data, and its standing instruction says to re-sync the artifact by slug.

Point the trigger at whoever owns the data source, not at yourself by default. Match the cadence to
the data — don't rebuild hourly over numbers that change weekly. If the source run also writes the
rows, one trigger does both: write, then sync.

`bun run build` after a code change, `bun run sync-data` after a data change. Both push when they
finish; there is no separate publish step, and running a full build for a data change is wasted time.
`ren artifacts sync <slug>` pushes the built directory on its own — the repair path when a build
succeeded but the live page is stale, not part of the normal loop.

## The link is the capability

The share URL is **unauthenticated** — anyone holding it can read the page, with no Ren account and no
membership check. Say that when you hand over the link, and say it plainly in a shared channel where
the audience is wider than the person who asked.

Two consequences worth naming when they apply:

- Only `build/` is reachable. `src/` and `sync-data.ts` are stored but never served, so query logic and
  column names stay private even though the page is public.
- The URL is stable across rebuilds, so it can be pasted into a doc or a channel topic — which also
  means an accidental share stays live.

## Lifecycle

- **One artifact per subject, not per question.** Slugs are unique per pod and permanent in the URL;
  ten single-chart pages are worse than one page with ten. Before building, check what the pod already
  has and edit that instead.
- **Hand the URL over once**, after the first successful build with its data in place. Repeating it
  every turn is noise, and a link handed over before `data.json` exists looks broken.
- **Archiving takes the URL offline** and keeps the bytes. Recreating the same slug later inherits
  those bytes but mints a **new token**, so the old link stays dead — anything that pinned it breaks.
  Say so before archiving something you know was shared.
- **A mid-sync viewer can catch a half-updated page** for a few seconds. It resolves on refresh, so
  don't design around it — but don't promise atomic updates either.

## Outcome contract for a scheduled artifact

The same four things, in artifact terms: **what refreshes it** (which trigger, on which agent),
**where it lands** (the URL, and who can reach it), **how often**, and **how to stop it** (disable the
trigger — the page stays up, frozen at its last sync, until archived).
