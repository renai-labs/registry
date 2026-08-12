---
name: ren-artifact
description: >-
  Build and publish artifacts — browsable pages hosted at a shareable URL.
  Use when the deliverable is something to look at rather than download: a
  dashboard over a pod SQLite database, a written report, a comparison table,
  an interactive view. Covers scaffolding the project, the data-refresh
  pattern, theming, and the platform rules a page must follow to render.
metadata:
  tags:
    - ren
    - design
---

# Artifacts

An artifact is a React project on the pod at `/home/user/artifacts/<slug>/`. You build it, and Ren
serves the `build/` folder at a URL the user can share. The project survives sandbox recycles, so a
later session can edit and rebuild it.

## When to use this

Use an artifact when the user wants a link to something visual — a dashboard, a report, a table they
will re-open later.

Use `show_file` instead when they want a file to download. The two are not interchangeable: `show_file`
puts a file in the transcript, an artifact puts a page on the web.

## Create one

```bash
ren artifacts scaffold q3-report --title "Q3 Revenue Report" \
  --template <this skill's base directory>/assets/template.tar.gz
```

`--template` points at the starter project bundled with this skill. Use the base directory given to you
when this skill loaded — the starter ships here, not in the sandbox image, so it stays in step with
these instructions.

This creates the project, installs dependencies, runs a first build, and prints the URL. The install
takes a few seconds. Give the user that URL once, after the first build succeeds.

```
/home/user/artifacts/q3-report/
  src/            your code
  src/theme.css   all colors and fonts, one file
  sync-data.ts    your query script, if the page shows data
  build/          what gets served — never edit by hand
```

Then write your code in `src/` and run:

```bash
bun run build       # after any code change
bun run sync-data   # after any data change
```

Both commands push to S3 when they finish. There is no separate publish step.

## Platform rules

These are enforced by the server, not suggestions. A page that breaks them renders blank or unstyled.

- **The built page can't reach the network.** You have full internet in the sandbox, so download
  whatever you need while building — packages, fonts, images. It just has to end up inside the build.
  A font file in `src/` works; a `<link>` to Google Fonts does not, and fails silently.
- **The page can only fetch its own files.** `fetch('./data.json')` works. Any other host is blocked at
  runtime, including the Ren API. Fetch remote data in `sync-data.ts` instead and write it to
  `data.json`.
- **Only `build/` is public.** Your `src/` and `sync-data.ts` are stored but never served, so query
  logic stays private.
- **Use relative paths.** The page is served under a token prefix, so `/assets/x.png` resolves to the
  wrong place. Write `./assets/x.png`.

## Data dashboards

The common pattern: a skill writes rows into a pod SQLite database, and the artifact reads them.

Data is **not** compiled into the page. `sync-data.ts` queries the database and writes
`build/data.json`; the page fetches that file when it loads. So refreshing the numbers is
`bun run sync-data` — no rebuild, no code change, and the URL stays the same. A cron trigger can run it.

Write `sync-data.ts` fresh for each artifact, but always keep the contract: read from
`/home/user/db/<slug>.db`, write to `build/data.json`. See `references/data-contract.md`.

Pages with no data skip the script entirely.

## Theming

Every color, font, and radius lives in `src/theme.css` as CSS variables, in a light block and a dark
block. Components and charts read from those variables and never hardcode a color.

This means the user can restyle an artifact by editing one file, or by asking you to. Don't scatter
colors through components — it takes that away from them.

Every artifact ships a light/dark toggle that follows the system setting by default, so the viewer
controls appearance without anyone editing anything.

## Update an existing artifact

Run these commands from the Ren sandbox. They infer the current pod from the sandbox token: do not pass a
pod ID or artifact ID.

```bash
ren artifacts list
ren artifacts archive q3-report
```

`ren artifacts list` shows what the current pod has. Edit `src/`, run `bun run build`, and the live URL updates.
The URL never changes, so anyone holding the link sees the new version on their next refresh.

`ren artifacts archive <slug>` archives the artifact by slug and takes its URL offline. Its S3 copy is kept as
backup. It does not delete the local working directory from an already-running sandbox.

## Gotchas

- **Give the URL once.** It doesn't change between builds. Repeating it every turn is noise.
- **Don't build a "loading" state around missing data.** If `data.json` isn't there, the artifact isn't
  finished. Run `sync-data` before handing over the link.
- **Check the build output.** Parcel reports errors and keeps serving the last good build, so a failed
  build looks like nothing happened.
- **One artifact per subject.** Ten dashboards with one chart each is worse than one with ten. Slugs are
  unique per pod and permanent in the URL, so pick a name that will still make sense next quarter.
- **Charts need a height.** `ChartContainer` with no resolved height renders nothing.

## References

| File | Read it when |
| --- | --- |
| `references/data-contract.md` | Writing `sync-data.ts` or shaping `data.json` |
| `references/design.md` | Laying out a page, choosing chart colors, styling from scratch |
| `references/components.md` | Picking a component or building a chart |
| `references/troubleshooting.md` | The page renders blank, unstyled, or stale |
