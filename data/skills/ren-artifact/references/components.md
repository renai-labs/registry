# Components

The template ships shadcn/ui and Recharts, already installed and themed. Import them; don't hand-roll
equivalents and don't add a second UI library. Installing something else is allowed when a page genuinely
needs it — a map, a diagram library — it just has to bundle, since the page can't load it at runtime.

## shadcn/ui

The 53 components live under `src/components/ui/` and read their colors from `src/theme.css`, so they
follow the theme and the dark toggle without extra work.

The ones a report actually uses:

| Component | Use for |
| --- | --- |
| `Card` | Grouping a chart or a set of figures |
| `Table` | Any tabular data. Don't build a grid of divs |
| `Badge` | Status, deltas, categories |
| `Tabs` | Alternate views of one dataset |
| `Separator` | Splitting sections inside a card |
| `Tooltip` | Explaining a metric definition |
| `Alert` | A caveat about the data — stale source, partial period |
| `Skeleton` | While `data.json` is loading |

The rest of the set is available. Reach for it when a page needs it, not to fill space.

Style through the theme variables. Editing a component's own file makes it drift from every other
artifact and takes theming away from the user.

## Charts

Recharts is installed, but go through `ChartContainer` from `@/components/ui/chart` rather than using
Recharts directly. It sizes the chart, wires the theme colors, and gives you a tooltip that works in
dark mode.

```tsx
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const config = {
  total: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

<ChartContainer config={config} className="h-[300px] w-full">
  <BarChart data={data.revenue}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} axisLine={false} />
    <YAxis tickLine={false} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="total" fill="var(--color-total)" radius={4} />
  </BarChart>
</ChartContainer>
```

Rules that save a debugging round:

- **Give `ChartContainer` a height class.** It defaults to a video aspect ratio; a chart in a container
  with no resolved height renders nothing. This is the most common chart failure.
- Series colors come from the `config`, referenced as `var(--color-<key>)`. That is what keeps a chart
  following the theme toggle.
- Use the `--chart-1` … `--chart-6` variables in order. Don't invent colors.
- Turn off `tickLine`, `axisLine`, and vertical grid lines. The defaults are noisy.
- Format axis ticks with `tickFormatter`, not by pre-formatting numbers into strings in `data.json`.

Chart types: `BarChart` for comparison across categories, `LineChart` for change over time, `AreaChart`
only for cumulative totals, `PieChart` almost never (see `design.md`).

## Page structure

```tsx
<main>
  <Header title="Q3 Revenue" generatedAt={data.generatedAt} />
  <StatRow />       {/* two or three figures that answer the question */}
  <ChartCard />     {/* the shape of the data */}
  <DetailTable />   {/* the values */}
</main>
```

Keep `App.tsx` a layout file. Put each section in its own component under `src/components/`, so a later
edit touches one file.

## The theme toggle

The template includes it. Leave it in — it's how a reader gets dark mode without anyone editing code.
