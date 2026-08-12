# The data contract

Every artifact that shows data follows the same shape. Read the pod database, write one JSON file, let
the page fetch it.

```
/home/user/db/<slug>.db   →   sync-data.ts   →   build/data.json   →   fetch('./data.json')
```

The query is different for every artifact. The contract is not.

## sync-data.ts

```ts
import { Database } from "bun:sqlite"
import { writeFileSync } from "node:fs"

const db = new Database("/home/user/db/analytics.db", { readonly: true })

const revenue = db.query(`
  select month, sum(amount) as total
  from invoice
  where status = 'paid'
  group by month
  order by month
`).all()

const totals = db.query(`select count(*) as invoices, sum(amount) as total from invoice`).get()

writeFileSync("build/data.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  totals,
  revenue,
}, null, 2))

console.log(`wrote ${revenue.length} rows`)
```

Open the database `readonly`. The artifact reads; the skill that owns the data writes.

## Shaping data.json

Do the work in SQL, not in the browser. The page should render what it receives without aggregating,
joining, or filtering. If a chart needs monthly totals, write monthly totals.

- **Top-level keys per section of the page.** One key per chart or table, named after it.
- **Arrays of flat objects.** Recharts reads `[{ month: "Jan", total: 4200 }]` directly. Nested shapes
  need unwrapping in the component, which is work you already skipped by doing it in SQL.
- **Always include `generatedAt`.** Show it in the footer so a reader knows how fresh the numbers are.
  Without it a stale page looks current.
- **Pre-format nothing else.** Send numbers as numbers and dates as ISO strings; format at render time
  so the page controls its own presentation.

## Reading it in the page

```tsx
const [data, setData] = useState<Data | null>(null)

useEffect(() => {
  let cancelled = false
  fetch("./data.json")
    .then((r) => r.json())
    .then((d) => { if (!cancelled) setData(d) })
  return () => { cancelled = true }
}, [])

if (!data) return <Skeleton />
```

The relative path matters. `/data.json` resolves to the host root and 404s.

## Refreshing

`bun run sync-data` rewrites `build/data.json` and syncs. Nothing rebuilds, the URL doesn't change, and
the reader sees new numbers on their next refresh.

This is what a cron trigger runs. Point it at the script, not at a rebuild.

If the shape of the data changes, the page code changes too — that needs `bun run build` as well.

## Failing loudly

If a query returns nothing, throw. A `data.json` full of empty arrays produces a page of zeroes that
looks like a working dashboard reporting no business.

```ts
if (revenue.length === 0) throw new Error("no paid invoices found — check the source data")
```
