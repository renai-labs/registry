---
name: shopify-reporting
description: >-
  Read-only Shopify analytics with ShopifyQL over the Admin GraphQL API. Use when
  the ask is for numbers rather than records — totals, rates, trends, funnels, or
  breakdowns across sales, orders, AOV, discounts, returns, sessions, checkout
  conversion, traffic sources, inventory, payments, or fulfilment speed, sliced by
  dimension, bucketed over time, or compared period-over-period. Use for "checkout
  funnel last month", "why did conversion drop", "sales by channel this quarter vs
  last", "top landing pages by completed checkouts", even when the user does not
  say "report" or "analytics". Not for fetching or changing individual products,
  orders, or customers — that is the shopify skill.
license: MIT
metadata:
  author: Ren Labs
  source: 'https://shopify.dev/docs/api/shopifyql'
  icon: 'https://cdn.renai.build/skill-icons/shopify.svg'
  tags:
    - analytics
    - e-commerce
  requiredCredentials:
    - kind: env
      name: SHOPIFY_ACCESS_TOKEN
      description: Admin API access token for a custom app with the read_reports scope.
    - kind: env
      name: SHOPIFY_STORE_DOMAIN
      description: Permanent myshopify.com subdomain, e.g. my-store.myshopify.com.
---

# Shopify reporting — ShopifyQL

ShopifyQL computes aggregates the Admin GraphQL API cannot: sessions, conversion
rates, funnels, period-over-period comparisons. It is read-only — `FROM … SHOW …`,
never `SELECT`, and the language has no mutations.

Numbers come from here; individual records come from the `shopify` skill.

Never derive rates by paginating orders. Orders give completed checkouts with no
denominator, so conversion and abandonment cannot be computed that way.

Optional: `SHOPIFY_API_VERSION`, defaulting to `2026-07` below. Needs `curl` and `jq`.

## Running a query

`shopifyqlQuery(query: String!)` takes a plain string, so pass the ShopifyQL as a
GraphQL variable — the docs' triple-quoted block string needs escaping when built
programmatically.

```bash
shopifyql() {
  jq -nc --arg q "$1" '{
    query: "query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name dataType displayName } rows } parseErrors } }",
    variables: { q: $q }
  }' | curl -sS -X POST \
    "https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION:-2026-07}/graphql.json" \
    -H "Content-Type: application/json" \
    -H "X-Shopify-Access-Token: ${SHOPIFY_ACCESS_TOKEN}" \
    --data @-
}
```

A query fails in three places, and an invalid field lands in the third, which
ordinary GraphQL does not have. HTTP 200 does not mean success.

1. `.errors` — transport and auth, e.g. a token missing `read_reports`
2. `.data.shopifyqlQuery.parseErrors` — invalid ShopifyQL, e.g.
   `["Column Not Found: Column 'total_sale' not found"]`
3. `.data.shopifyqlQuery.tableData` — `null` whenever `parseErrors` is non-empty

Read rows through the checker, not directly:

```bash
shopifyql_rows() {
  local out; out="$(shopifyql "$1")" || return 1
  if [ "$(jq -r '.errors | length' <<<"$out")" != "0" ]; then
    jq -r '.errors[].message' <<<"$out" >&2; return 1
  fi
  if [ "$(jq -r '.data.shopifyqlQuery.parseErrors | length' <<<"$out")" != "0" ]; then
    jq -r '.data.shopifyqlQuery.parseErrors[]' <<<"$out" >&2; return 1
  fi
  jq '.data.shopifyqlQuery.tableData' <<<"$out"
}
```

## Choosing a schema

Rejected queries almost always use a field the docs never surfaced — a metric
promoted into its own `FROM` table, or a field written as `table.column`.

A metric belongs to exactly one schema. If the schema you picked does not list it,
the schema is wrong; find the right one rather than forcing the query.

**Read `references/schemas.md` before naming any metric.** It lists every schema's
metrics and the `sessions` dimensions. When a `parseErrors` entry names a column, fix
it against that file.

Common routes:

- Conversion, funnel, traffic, devices, landing pages → `sessions`
- Revenue, orders, AOV, margin, returns → `sales`
- Checkout failing at payment → `payment_attempts`
- Campaign-attributed funnel → `campaign_sessions`, whose metrics are `campaign_`-prefixed
- Core Web Vitals → `web_performance`

## Syntax

```
FROM <schema>[, <schema>…]
  SHOW <metric|dimension|expression> [AS <alias>][, …]
  WHERE <condition>
  GROUP BY [ONLY] [TOP <n>] <dimension> [OVERALL][, …]
  TIMESERIES <second|minute|hour|day|week|month|quarter|year|hour_of_day|day_of_week|week_of_year|month_of_year>
  WITH <modifier>[, …]
  SINCE <date> [UNTIL <date>]   — or — DURING <named_range>
  COMPARE TO <comparison>
  HAVING <condition>
  ORDER BY <column> [ASC|DESC][, …]
  LIMIT <n>
```

Three things worth knowing up front:

- **`FROM` takes several schemas**, joined on shared dimensions —
  `FROM sales, sessions` puts revenue and funnel in one result.
- **`COMPARE TO` prefixes its columns** with `comparison_`, while `WITH` suffixes
  them. `comparison_net_sales__previous_year` exists;
  `total_sales__previous_period` does not.
- **Date functions beat bare offsets.** `SINCE startOfMonth(-1m) UNTIL
  endOfMonth(-1m)` is a whole calendar month. `SINCE -30d` includes a partial today,
  which makes the newest bucket look like a drop.

**Read `references/syntax.md`** for date parameters, `WITH` modifiers, generated
column names, `COMPARE TO` targets, `WHERE`/`HAVING` grammar, `TOP`, and `VISUALIZE`.

## Checkout funnel

`sessions` is one row per online store visit, and the only source of a funnel
denominator.

| Metric | Type | Meaning |
|---|---|---|
| `sessions` | INTEGER | visits — the denominator |
| `online_store_visitors` | INTEGER | unique visitors |
| `sessions_with_cart_additions` | INTEGER | added to cart |
| `sessions_that_reached_checkout` | INTEGER | reached checkout |
| `sessions_that_completed_checkout` | INTEGER | purchased |
| `added_to_cart_rate` | PERCENT | cart additions ÷ sessions |
| `reached_checkout_rate` | PERCENT | reached ÷ sessions |
| `conversion_rate` | PERCENT | completed ÷ **sessions** |
| `checkout_conversion_rate` | PERCENT | completed ÷ **reached checkout** |
| `bounce_rate`, `bounces` | PERCENT, INTEGER | single-pageview visits |
| `pageviews`, `pageviews_per_session` | INTEGER, DECIMAL | engagement |
| `average_session_duration` | SECOND_DURATION | seconds |

`conversion_rate` and `checkout_conversion_rate` have different denominators. State
which one a reported number is.

Filter bots on every query — `WHERE human_or_bot_session = 'human'` — or they inflate
`sessions` and depress every rate.

## Recipes

Daily funnel against the prior period:

```
FROM sessions
  SHOW sessions, sessions_with_cart_additions,
    sessions_that_reached_checkout, sessions_that_completed_checkout,
    conversion_rate, checkout_conversion_rate
  WHERE human_or_bot_session = 'human'
  TIMESERIES day
  DURING last_month
  COMPARE TO previous_period
  ORDER BY day ASC
```

Where the funnel leaks, by device:

```
FROM sessions
  SHOW sessions, added_to_cart_rate, reached_checkout_rate, checkout_conversion_rate
  WHERE human_or_bot_session = 'human'
  GROUP BY session_device_type WITH TOTALS
  DURING last_month
  ORDER BY sessions DESC
```

Traffic sources ranked by completed checkouts:

```
FROM sessions
  SHOW sessions, conversion_rate, sessions_that_completed_checkout
  WHERE human_or_bot_session = 'human'
  GROUP BY referrer_source, session_device_type WITH TOTALS, GROUP_TOTALS
  HAVING sessions > 100
  SINCE startOfDay(-90d) UNTIL endOfDay(-1d)
  ORDER BY sessions_that_completed_checkout DESC
  LIMIT 50
```

Revenue over whole months, excluding the current partial one:

```
FROM sales
  SHOW gross_sales, discounts, net_sales, orders, average_order_value
  TIMESERIES month WITH PERCENT_CHANGE
  SINCE startOfMonth(-12m) UNTIL endOfMonth(-1m)
  COMPARE TO previous_year
  ORDER BY month ASC
```

## Reading results

`tableData.columns[]` carries `name`, `dataType`, `displayName`; `rows` is an array of
objects keyed by column name. Format from `dataType`, not from the value.

- `PERCENT` is a decimal — `0.25` is 25%.
- `MONEY` is a string — `"49.00"`, not `49.0`. Do not `tonumber` it where precision or
  zero-padding matters.
- `SECOND_DURATION` is a number of seconds.
- `COMPARE TO` and `WITH` add columns; read `columns[]` rather than assuming a shape.

## Gotchas

- **`read_reports` is not implied by any other scope.** Without it the failure appears
  in `.errors`, not `parseErrors`.
- **Level 2 protected customer data** is documented as required for `shopifyqlQuery`.
  A first-party custom app may not hit that gate. Confirm with
  `FROM sales SHOW total_sales DURING last_month` before building on it.
- **Data lags real time.** Do not use ShopifyQL to reconcile an order just placed.
- **`WITH PERCENT_CHANGE` is silent without `COMPARE TO`** — no error, no columns.
- **`GROUP BY TOP` adds an `Other` row** that is not a real dimension value.

Report every number with its denominator and window. When a metric does not exist,
say so rather than substituting a near-miss field.
