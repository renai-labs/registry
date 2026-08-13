# ShopifyQL syntax

Full clause reference for the 2026-07 API version. `SKILL.md` carries the query
skeleton and the common cases; read this for date handling, modifiers, generated
column names, and filter grammar.

## Contents

- [Clause order](#clause-order)
- [Multi-fact queries](#multi-fact-queries)
- [Expressions and AS](#expressions-and-as)
- [Time dimensions](#time-dimensions)
- [Date parameters](#date-parameters)
- [WITH modifiers](#with-modifiers)
- [Generated column names](#generated-column-names)
- [COMPARE TO targets](#compare-to-targets)
- [WHERE and HAVING](#where-and-having)
- [GROUP BY TOP](#group-by-top)
- [VISUALIZE](#visualize)

## Clause order

```
FROM [ORGANIZATION] <schema>[, <schema>…]
  SHOW <metric|dimension|expression> [AS <alias>][, …]
  WHERE <condition>
  GROUP BY [ONLY] [TOP <n>] <dimension> [OVERALL][, …]
  TIMESERIES <time_dimension>
  WITH <modifier>[, …]
  SINCE <date> [UNTIL <date>]   — or — DURING <named_range>
  COMPARE TO <comparison>
  HAVING <condition>
  ORDER BY <column> [ASC|DESC][, …]
  LIMIT <n>
VISUALIZE <metric|alias> [TYPE <type>][, …] [MAX <n>] [ANNOTATE <annotation>]
```

`FROM` is required. Every query needs `SHOW` or `VISUALIZE`.

One `WITH` clause per query — multiple modifiers go in it, comma separated. It can
stand alone (`WITH CURRENCY 'USD'`) or trail `GROUP BY` / `TIMESERIES`.

`DURING` cannot combine with `SINCE` or `UNTIL`, and does not accept `now`.

## Multi-fact queries

`FROM` accepts several schemas, combined on shared dimensions:

```
FROM sales, sessions
  SHOW total_sales, sessions, conversion_rate
  TIMESERIES day
  DURING last_month
```

Every `GROUP BY` field must exist with the same name in each schema. Not all schemas
can be combined.

## Expressions and AS

`SHOW` accepts computed values using `+ - * /` over numeric fields or literals.

An alias propagates into generated column names: `SHOW net_sales AS revenue … WITH
FIRST_CLICK_ATTRIBUTION` yields `revenue__first_click`, not `net_sales__first_click`.

## Time dimensions

Intervals: `second` `minute` `hour` `day` `week` `month` `quarter` `year`.
Cyclical: `hour_of_day` (0-23), `day_of_week` (0-6), `week_of_year` (1-53),
`month_of_year` (1-12).

Without explicit bounds `TIMESERIES` applies a default range per dimension — `day` →
last 30d, `week` → last 4w, `month` → last 3m. Set the period explicitly instead.

## Date parameters

- Absolute — `2026-01-31`, `2026-01-31T14:00:00`, unquoted
- Relative — `-30d`, `-24h`, `-4q`; units `s min h d w m q y`
- Named — `now` `today` `yesterday` `this_week` `this_month` `this_quarter`
  `this_year` `last_week` `last_month` `last_quarter` `last_year` `this_weekend`
  `last_weekend` `bfcm2020`…`bfcm2025`
- Functions — `startOfDay(-30d)`, `endOfMonth(-1m)`, `startOfQuarter(-1q)`; also
  `Minute` `Hour` `Week` `Year`. The function unit must match the offset unit.

Prefer date functions. `SINCE startOfMonth(-1m) UNTIL endOfMonth(-1m)` is last whole
calendar month; `SINCE startOfDay(-30d) UNTIL endOfDay(-1d)` excludes today. A bare
`SINCE -30d` includes a partial today, making the last bucket look like a drop.

## WITH modifiers

`TOTALS`, `GROUP_TOTALS`, `PERCENT_CHANGE`, `CUMULATIVE_VALUES`,
`CURRENCY '<code>'`, `TIMEZONE '<iana_zone>'`, and attribution models
`FIRST_CLICK_ATTRIBUTION`, `LAST_CLICK_ATTRIBUTION`,
`LAST_NON_DIRECT_CLICK_ATTRIBUTION`, `ANY_CLICK_ATTRIBUTION`, `LINEAR_ATTRIBUTION`.

- `PERCENT_CHANGE` adds no columns without a `COMPARE TO`.
- `CUMULATIVE_VALUES` applies only to additive metrics, not to rates like
  `conversion_rate` or `average_order_value`.
- `TIMEZONE` decides which day a near-midnight sale falls in. Set it on any recurring
  report or day boundaries will not match the merchant's admin.
- `GROUP_TOTALS` needs at least two grouped dimensions.

## Generated column names

Modifiers and comparisons add columns beyond what `SHOW` names. Order and read by the
generated name.

| Source | Column |
|---|---|
| `WITH TOTALS` | `net_sales__totals` |
| `WITH GROUP_TOTALS` | `total_sales__billing_country_totals` — `{metric}__{dimension_prefix}_totals` |
| `WITH CUMULATIVE_VALUES` | `net_sales__cumulative` |
| attribution | `net_sales__first_click`, `__last_click`, `__last_non_direct_click`, `__any_click`, `__linear` |
| `COMPARE TO previous_year` | `comparison_net_sales__previous_year` |
| `COMPARE TO 2023-01-01` | `comparison_net_sales__20230101` |
| `COMPARE TO startOfQuarter(-3q)` | `comparison_net_sales__startOfQuarter_sub_3q` — `-` becomes `sub` |
| `PERCENT_CHANGE` + compare | `percent_change_net_sales__previous_year` |

`WITH` suffixes the metric; `COMPARE TO` prefixes it with `comparison_`.
`total_sales__previous_period` does not exist.

## COMPARE TO targets

Relative: `previous_period` `previous_year` `previous_year_match_day_of_week`
`previous_quarter` `previous_month` `previous_week` `previous_day` `previous_hour`
`previous_minute` `previous_second`.

Also accepts an absolute date, a named range, or a date function — each optionally
with `UNTIL` — or `TARGETS` where the schema supports it.

## WHERE and HAVING

Same grammar. `WHERE` filters rows before aggregation; `HAVING` filters after, on
returned metrics, dimensions, aliases, or literals.

```
column <op> value                     -- = != > >= < <=
column [NOT] IN (value, …)
column [NOT] BETWEEN low AND high
column STARTS WITH | ENDS WITH | [NOT] CONTAINS value
column IS [NOT] NULL | TRUE | FALSE
match_expression [NOT] MATCHES (parameter_list)
```

Combine with `AND` / `OR` / `NOT` and parentheses. Not every generated column works in
`HAVING`, even when it is valid in `ORDER BY`.

## GROUP BY TOP

`TOP <n>` limits a high-cardinality dimension like `product_title` or
`landing_page_path` to its highest-ranked values, ranked by the aggregated metric.

- The remainder collapses into a single `Other` row, so totals still reconcile. It is
  not a real dimension value.
- `ONLY TOP n` drops the `Other` row.
- `TOP n <dimension> OVERALL` ranks across the whole result rather than within each
  preceding `GROUP BY` dimension.

## VISUALIZE

Only affects rendering — the rows returned are identical, so it is irrelevant when
consuming `tableData`.

Types: `bar` `grouped_bar` `horizontal_bar` `horizontal_grouped_bar` `stacked_bar`
`stacked_horizontal_bar` `single_stacked_bar` `line` `stacked_area` `donut` `sunburst`
`treemap` `radar` `funnel` `waterfall` `histogram` `scatter_plot` `bubble_chart`
`heatmap` `calendar_heatmap` `rfm_grid` `single_metric` `table` `list`
`list_with_dimension_values`.

With multiple metrics a `TYPE` applies to the metric it follows and any earlier ones
without their own.
