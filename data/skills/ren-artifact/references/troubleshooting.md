# Troubleshooting

Work top to bottom. Most failures are one of the first three.

## The page is blank

Open the browser console if the user can share it, then check in this order:

1. **A build error.** Parcel keeps serving the last good build, so a failed build looks like nothing
   changed. Re-run `bun run build` and read the output.
2. **`data.json` is missing.** The page fetched `./data.json` and got a 404, so it never left the
   loading state. Run `bun run sync-data`.
3. **An absolute path.** `fetch("/data.json")` or `src="/logo.png"` resolves to the host root, not the
   artifact. Make every path relative: `./data.json`.

## The page has no styling

The page referenced another host at runtime and the request was blocked. This works during the build and
fails in the browser, which is why it slips through.

- Replace a Google Fonts `<link>` with the system stack, or download the woff2 into `src/` and
  `@font-face` it.
- Replace `<script src="https://…">` with the installed package.
- Replace remote images with files in `src/` or data URIs.

The failure is silent. There is no error banner, just an unstyled page.

## The numbers are stale

`bun run sync-data` regenerates `build/data.json` and syncs. If the page still shows old values:

- The browser cached it. Hard refresh.
- The sync ran against a database the skill hadn't written to yet. Check `generatedAt` in the footer.
- The script wrote to the wrong path. It must be `build/data.json`, relative to the project root.

## A chart is invisible

`ResponsiveContainer` inside a parent with no height renders nothing at all. Give the wrapper an
explicit height. See `components.md`.

If the chart renders but the bars don't, the `dataKey` doesn't match a field in the data. Log one row
and compare.

## Dark mode looks wrong

A component or chart hardcoded a color instead of reading a theme variable. Search for `#` in `src/`
outside `theme.css` — anything you find is the bug.

Recharts `Tooltip` needs explicit styling; its default is a white box.

## The build is slow

The template's dependencies come from a cache in the image, so they install instantly. Anything else is
a real download — fine, just slower. Prefer what the template already ships: shadcn/ui and Recharts
cover almost every report.

## The URL 404s

- The first build hasn't run. `bun run build`.
- The slug is wrong. In the Ren sandbox, `ren artifacts list` shows what exists in the current pod.
- The artifact was archived. Archiving takes its URL offline; the S3 copy stays as a backup.

## Something outside the page is broken

`src/` and `sync-data.ts` are stored but never served, so they can't be the cause of a rendering bug.
Only `build/` reaches the browser.
