---
name: shopify-reporting
description: >-
  Read-only Shopify analytics and reporting with ShopifyQL over the Admin
  GraphQL API. Use whenever the ask is for numbers, totals, rates, trends,
  funnels, or breakdowns rather than individual records — sales, orders, AOV,
  discounts, returns, sessions, checkout conversion, traffic sources, inventory,
  payments, fulfilment speed — sliced by dimension, bucketed over time, or
  compared period-over-period. Examples: "checkout funnel last month", "why did
  conversion drop", "sales by channel this quarter vs last", "top landing pages
  by completed checkouts". Runs headlessly with a token and curl, so it works
  inside a sandbox. Not for fetching or mutating individual products, orders, or
  customers.
license: MIT
metadata:
  author: Ren Labs
  source: 'https://shopify.dev/docs/api/shopifyql'
  icon: 'https://cdn.renai.build/skill-icons/shopify.svg'
  tags:
    - analytics
    - e-commerce
  requiredCredentials:
    - name: SHOPIFY_ACCESS_TOKEN
      description: Admin API access token (shpat_…) for a custom app with the read_reports scope. ShopifyQL is read-only — do not grant write scopes for reporting.
    - name: SHOPIFY_STORE_DOMAIN
      description: Permanent myshopify.com subdomain, e.g. my-store.myshopify.com. Not the custom domain.
---

# Shopify reporting — ShopifyQL

ShopifyQL is Shopify's analytics query language. It computes aggregates the Admin
GraphQL API cannot: sessions, conversion rates, funnels, period-over-period
comparisons. It is **read-only by construction** — `FROM … SHOW …`, never
`SELECT`, no mutations exist in the language.

**Use this skill for numbers. Use the `shopify` skill for records.** If the answer
is a table of aggregates, it is ShopifyQL. If it is "fetch order #1234" or "update
this variant's price", it is not.

Do not compute rates by paginating orders. Without `sessions` you have no
denominator, so conversion and abandonment are simply unmeasurable that way.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `SHOPIFY_ACCESS_TOKEN` | yes | `shpat_…`, needs `read_reports` |
| `SHOPIFY_STORE_DOMAIN` | yes | `my-store.myshopify.com` |
| `SHOPIFY_API_VERSION` | no | defaults to `2026-07` below |

**CLI deps:** `curl`, `jq`

## Running a query

`shopifyqlQuery(query: String!)` takes the ShopifyQL as a plain string argument, so
pass it as a **GraphQL variable**. Shopify's docs show a triple-quoted block string
instead; the variable is better here because it removes all quoting and escaping
problems when the query is built programmatically.

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

### Check three error channels, not one

HTTP 200 means nothing. A query can fail in three separate places, and a bad field
name lands in the third — which does not exist for ordinary GraphQL:

1. `.errors` — GraphQL transport/auth errors (bad token, missing scope)
2. `.data.shopifyqlQuery.parseErrors` — **invalid ShopifyQL**, e.g. `["Column Not Found: Column 'total_sale' not found"]`
3. `.data.shopifyqlQuery.tableData` is `null` when `parseErrors` is non-empty

Always run through a checker rather than reading `.rows` directly:

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

A `parseErrors` entry names the offending column. Fix it against the schema
reference — never by guessing a different name.

## Never invent field names

This is the dominant failure mode. Rejected queries are almost always assembled
from fields, metrics, or clauses the docs never surfaced — SQL-ifying a field into
`table.column`, or promoting a metric into its own `FROM` table.

**A metric that one schema owns does not exist in another.** If the schema you
picked does not list the metric, you picked the wrong schema — go find the right
one rather than forcing the query into a more familiar table.

The `sessions` reference below is inlined because it is the schema most reporting
work needs. **For every other schema, look up its field list before writing the
query**: `https://shopify.dev/docs/api/shopifyql/latest/schemas` — append
`/<category>/<schema>.md` for a machine-readable field reference. If the
`shopify-dev` MCP is available, its doc search does the same job.

### Schema index

Pick `FROM` deliberately from this list, then read that schema's fields.

| Area | Schemas |
|---|---|
| Sales revenue | `sales`, `discounts`, `returns`, `sales_taxes`, `subscriptions` |
| Sessions & behaviour | `sessions`, `searches`, `search_queries`, `search_conversions`, `web_performance`, `shopify_forms`, `product_recommendation_conversions`, `global_searches`, `low_engagement_product_recommendations`, `shop_product_impressions`, `shop_post_purchase_offers` |
| Orders | `fulfillments`, `profitability`, `shipping_labels` |
| Customers | `customers` |
| Marketing | `campaign_sessions`, `campaign_sales`, `campaign_products`, `marketing_engagements`, `shop_campaign_insights` |
| Finance & payments | `payments`, `payment_attempts`, `payouts`, `fees`, `chargebacks`, `gift_cards`, `store_credit_summaries`, `store_credit_transactions` |
| Inventory | `inventory`, `inventory_by_location`, `inventory_adjustment_history`, `inventory_shipments`, `inventory_transfers` |

Routing notes:

- Conversion, funnel, traffic, devices, landing pages → `sessions`
- Revenue, orders, AOV → `sales`
- Checkout failing at payment specifically → `payment_attempts`, not `sessions`
- Campaign-attributed funnel → `campaign_sessions` (not `sessions` + UTM, when the ask is about campaigns)

## Syntax

`FROM` is required; every query needs `SHOW` or `VISUALIZE`.

```
FROM <schema>
  SHOW <metric>[ AS <alias>][, …]
  WHERE <dimension> <op> <value>
  GROUP BY <dimension>[, …]
  TIMESERIES <time_dimension>
  WITH <modifier>[, …]
  SINCE <date_parameter> [UNTIL <date_parameter>]   — or — DURING <named_range>
  COMPARE TO <comparison>
  HAVING <metric> <op> <value>
  ORDER BY <column> <ASC|DESC>
  LIMIT <n>
VISUALIZE <column> TYPE <line|horizontal_bar|stacked_horizontal_bar|…>
```

**One `WITH` clause per query.** Multiple modifiers go in that single clause, comma
separated. It can stand alone (`WITH CURRENCY 'USD'`) or trail `GROUP BY` /
`TIMESERIES` — `TIMESERIES day WITH TOTALS, CUMULATIVE_VALUES` is still one clause.

**`DURING` cannot be combined with `SINCE` or `UNTIL`**, and does not accept `now`.

Omit `VISUALIZE` when consuming `tableData` programmatically — it only affects
rendering surfaces, and the rows come back the same.

### Time dimensions for `TIMESERIES`

Intervals: `second`, `minute`, `hour`, `day`, `week`, `month`, `quarter`, `year`.
Cyclical: `hour_of_day` (0-23), `day_of_week` (0-6), `week_of_year` (1-53),
`month_of_year` (1-12).

Without explicit bounds, `TIMESERIES` applies a default range per dimension
(`day` → last 30d, `week` → last 4w, `month` → last 3m). Set the period explicitly
for reports rather than relying on those.

### Date parameters

- **Absolute**: `2026-01-31`, `2026-01-31T14:00:00` — never quoted
- **Relative**: `-30d`, `-24h`, `-4q` — units `s min h d w m q y`
- **Named ranges**: `now`, `today`, `yesterday`, `this_week`, `this_month`,
  `this_quarter`, `this_year`, `last_week`, `last_month`, `last_quarter`,
  `last_year`, `this_weekend`, `last_weekend`, `bfcm2020`…`bfcm2025`
- **Date functions**: `startOfDay(-30d)`, `endOfMonth(-1m)`, `startOfQuarter(-1q)` —
  also `startOf/endOf` for `Minute`, `Hour`, `Week`, `Year`. The function's unit must
  match the offset unit.

**Use date functions for reports.** `SINCE startOfMonth(-1m) UNTIL endOfMonth(-1m)`
is last calendar month with no partial-period contamination;
`SINCE startOfDay(-30d) UNTIL endOfDay(-1d)` excludes today's incomplete data.
A bare `SINCE -30d` includes a partial today and will make the latest bucket look
like a drop.

### `WITH` modifiers

`TOTALS`, `GROUP_TOTALS`, `PERCENT_CHANGE`, `CUMULATIVE_VALUES`,
`CURRENCY '<code>'`, `TIMEZONE '<iana_zone>'`, and one or more attribution models
(`FIRST_CLICK_ATTRIBUTION`, `LAST_CLICK_ATTRIBUTION`,
`LAST_NON_DIRECT_CLICK_ATTRIBUTION`, `ANY_CLICK_ATTRIBUTION`, `LINEAR_ATTRIBUTION`).

- `WITH PERCENT_CHANGE` **silently adds no columns without a `COMPARE TO`**.
- `CUMULATIVE_VALUES` only applies to additive metrics — not to rates like
  `conversion_rate` or `average_order_value`.
- `WITH TIMEZONE` decides which day a sale near midnight falls in. Set it explicitly
  for any recurring report, or day boundaries will not match the merchant's admin.

### Generated column names

Modifiers and comparisons add columns beyond what `SHOW` names. **Reference these by
their generated name — ordering or reading by the base metric name will miss them.**
If `SHOW` used `AS`, the alias is used in the generated name.

| Source | Generated column |
|---|---|
| `WITH TOTALS` | `net_sales__totals` |
| `WITH GROUP_TOTALS` | `total_sales__billing_country_totals` — `{metric}__{dimension_prefix}_totals` |
| `WITH CUMULATIVE_VALUES` | `net_sales__cumulative` |
| attribution | `net_sales__first_click`, `__last_click`, `__last_non_direct_click`, `__any_click`, `__linear` |
| `COMPARE TO previous_year` | **`comparison_net_sales__previous_year`** |
| `COMPARE TO 2023-01-01` | `comparison_net_sales__20230101` |
| `COMPARE TO startOfQuarter(-3q)` | `comparison_net_sales__startOfQuarter_sub_3q` (`-` becomes `sub`) |
| `WITH PERCENT_CHANGE` + compare | `percent_change_net_sales__previous_year` |

Note the asymmetry: `WITH` modifiers **suffix** the metric, but `COMPARE TO`
**prefixes** it with `comparison_`. Reaching for `total_sales__previous_period` is
the most common mistake here — that column does not exist.

### `COMPARE TO` targets

Relative: `previous_period`, `previous_year`, `previous_year_match_day_of_week`,
`previous_quarter`, `previous_month`, `previous_week`, `previous_day`,
`previous_hour`, `previous_minute`, `previous_second`. Also accepts an absolute date,
a named range, a date function (each optionally with `UNTIL`), or `TARGETS` where the
schema supports it.

## The `sessions` schema — checkout funnel

One row per online store session. This is the only place the funnel denominator
exists.

**Metrics**

| Metric | Type | Meaning |
|---|---|---|
| `sessions` | INTEGER | visits — the funnel denominator |
| `online_store_visitors` | INTEGER | unique visitors |
| `sessions_with_cart_additions` | INTEGER | added to cart |
| `sessions_that_reached_checkout` | INTEGER | reached checkout |
| `sessions_that_completed_checkout` | INTEGER | purchased |
| `sessions_that_reached_and_completed_checkout` | INTEGER | reached, then purchased |
| `added_to_cart_rate` | PERCENT | cart additions ÷ sessions |
| `reached_checkout_rate` | PERCENT | reached ÷ sessions |
| `checkout_conversion_rate` | PERCENT | completed ÷ **reached checkout** |
| `completed_checkout_rate` | PERCENT | completed ÷ cart-adds that reached checkout |
| `conversion_rate` | PERCENT | completed ÷ **sessions** |
| `bounces`, `bounce_rate` | INTEGER, PERCENT | single-pageview visits |
| `pageviews`, `pageviews_per_session` | INTEGER, DECIMAL | engagement |
| `average_session_duration` | SECOND_DURATION | seconds |

`conversion_rate` and `checkout_conversion_rate` have different denominators.
Confusing them is the most common reporting error here — say which one a number is.

**Dimensions** (selected; full list in the docs)

- Time: `hour`, `day`, `week`, `month`, `quarter`, `year`, `day_of_week`, `hour_of_day`
- Traffic: `referrer_source`, `referrer_domain`, `referrer_name`, `referring_channel`, `referring_medium`, `traffic_type`, `agentic_referring_channel`
- Campaign: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- Landing: `landing_page_path`, `landing_page_type`, `landing_page_url`
- Device: `session_device_type`, `session_device_browser`, `session_device_os`
- Geo: `session_country`, `session_country_code`, `session_region`, `session_city`
- Quality: `human_or_bot_session`, `session_bounced`, `session_api_client`
- Customer: `customer_id`, `customer_email`, `rfm_group`, `customer_number_of_orders`

`agentic_referring_channel` attributes sessions to AI assistants (ChatGPT, Google AI
Mode and Gemini, Microsoft Copilot, Shop) — worth reporting on separately.

**Always filter bots.** `WHERE human_or_bot_session = 'human'` — otherwise bot
traffic inflates `sessions` and depresses every rate.

## Recipes

Daily checkout funnel vs the prior period:

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

Revenue trend over whole months, excluding the current partial one:

```
FROM sales
  SHOW gross_sales, discounts, net_sales, orders, average_order_value
  TIMESERIES month WITH PERCENT_CHANGE
  SINCE startOfMonth(-12m) UNTIL endOfMonth(-1m)
  COMPARE TO previous_year
  ORDER BY month ASC
```

Returns `comparison_net_sales__previous_year` and
`percent_change_net_sales__previous_year` alongside each base metric.

Verified `sales` fields: metrics `total_sales`, `gross_sales`, `net_sales`,
`discounts`, `orders`, `average_order_value`; dimensions `sales_channel`,
`product_title`, `product_type`, `billing_country`, `referring_channel`.
Verified `payments` fields: `net_payments`, `transactions`, `payment_method`.
Look up anything else before using it.

**Every recipe above that uses `COMPARE TO` returns its comparison values in
`comparison_<metric>__<period>` columns, not in the base metric column.**

## Reading results

`tableData.columns[]` carries `name`, `dataType`, `displayName`; `rows` is an array
of objects keyed by column name. Use `dataType` to format — do not infer from the
value.

- **`PERCENT` is a decimal.** `0.25` means 25%. Multiply for display.
- **`MONEY` is a string** — `"49.00"`, not `49.0`. Do not `tonumber` blindly if
  zero-padding or precision matters.
- **`SECOND_DURATION`** is seconds as a number.
- `COMPARE TO` and `WITH` add generated columns under the names in the table above.
  Read `columns[]` to discover the actual shape rather than assuming it.

## Access gotchas

- **`read_reports` is required** and is not implied by any other scope. A token
  without it fails in `.errors`, not `parseErrors`.
- **Level 2 protected customer data approval** is documented as required for
  `shopifyqlQuery`. For an app distributed through review this is a real gate; a
  first-party custom app on your own store may not hit it. Verify by running a
  trivial query (`FROM sales SHOW total_sales DURING last_month`) before building
  on top.
- Grant **only** `read_reports`. A reporting token with no write scopes cannot
  mutate anything, which removes the entire class of destructive-mutation risk.
- Data freshness lags real time; do not use ShopifyQL to reconcile an order that
  was just placed.

## Safety

Every query here is a read. There are no mutations in ShopifyQL, and a
`read_reports`-only token cannot perform one even by accident. Report numbers with
their denominator and window stated, and say plainly when a metric is unavailable
rather than substituting a near-miss field.
