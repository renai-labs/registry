---
name: meta-ads-analyze-catalog
description: Analyzes product catalog and dynamic product ad performance for Meta Ads. Produces product tier classifications (Heroes/Sidekicks/Zombies/Villains), feed quality audit, product set performance analysis, and catalog optimization recommendations. Use when asked to analyze or audit a product catalog or product feed, review DPA performance, or work out which products are performing.
---

# Analyze Catalog

## How to Call Meta Ads Tools

Call the mounted `meta_ads_*` MCP tools directly. Do not write a Python wrapper.

Use numeric account and catalog IDs without prefixes. Catalog-wide product listing uses
`meta_ads_catalog_search_product` with the required JSON-string filter; pass `"{}"` to match all
products. Existing product sets use `meta_ads_catalog_get_product_set_products` instead. Follow
the exact cursor returned by either tool until the requested scope is covered.

The catalog tools return inventory/configuration, not product-level ad performance. To classify
Heroes/Sidekicks/Zombies/Villains, require an Ads Manager export that includes a stable product
identifier plus spend and result value. Without that join, produce only the inventory/feed audit
and label performance tiers unavailable.

Contract caveat: empty `product_sets_with_items_blocked_in_ads`, product-set `visibility`, and
`creation_time` values are placeholders required by the pinned response schema, not verified
negative findings. `product_set_type` is inferred from whether a filter exists.

## Purpose

This skill analyzes product catalog performance for Meta Ads dynamic product ads (DPA), Advantage+ Catalog Ads, and catalog-driven campaigns. Product catalogs are unique in Meta Ads because the "creative" is generated dynamically from your feed data. This means feed quality directly equals ad quality, and product-level performance data reveals which products to promote, suppress, or improve.

The core output is a product tier classification system (Heroes, Sidekicks, Zombies, Villains) that gives media buyers and merchandising teams a shared language for catalog optimization decisions.

---

## Dependencies

This skill loads the following at Step 0:

| Dependency | Purpose |
|------------|---------|
| [[meta-ads-catalog-methodology]] | Complete catalog framework: feed optimization, DPA strategy, product scoring |
| [[meta-ads-account-maturity-methodology]] | Maturity-calibrated expectations for catalog campaigns |
| [[meta-ads-account-conventions]] | Account config, capability flags (has_catalog), KPI targets |

---

## Workflow

### Step 0: Load Dependencies

1. Read [[meta-ads-catalog-methodology]] for the complete catalog and DPA framework
2. Read [[meta-ads-account-conventions]] to confirm:
   - `has_catalog: true` for the target account(s)
   - Campaign types active (catalog_sales in `campaign_types_active`)
   - KPI targets (ROAS and CPA targets for catalog campaigns)
   - Business model (ecommerce, dual, etc.)
3. Read [[meta-ads-account-maturity-methodology]] to calibrate expectations

**Pre-flight validation:**
- If `has_catalog: false`, inform the user that no catalog is connected and offer to assess whether catalog ads should be set up
- Catalog campaigns require a minimum of 4 products to function, and realistically need 20+ for meaningful optimization

### Step 0.5: Catalog Data via MCP

Before pulling ad performance data, pull catalog structure directly via MCP tools:

```
MCP tool: `meta_ads_catalog_get_catalogs`
Parameters:
  ad_account_id: {numeric_ad_account_id}
Note: Returns all catalogs connected to the account. Confirm the correct catalog ID.

MCP tool: `meta_ads_catalog_get_details`
Parameters:
  catalog_id: {catalog_id}
Note: Returns catalog settings, name, vertical, counts, and business association. It does not
return catalog diagnostics.

MCP tool: `meta_ads_catalog_get_product_sets`
Parameters:
  catalog_id: {catalog_id}
Note: Returns all product sets with their rules and product counts.

MCP tool: `meta_ads_catalog_search_product`
Parameters:
  catalog_id: {catalog_id}
  filter: "{}"
  limit: 100
  fields: ["product_id", "retailer_id", "name", "description", "availability", "price",
           "brand", "category", "image_url", "image_fetch_status", "visibility"]
Note: Returns product-level data (title, availability, price, image URL, category).
Paginate with `page_info.after_cursor` while `page_info.has_next_page` is true.

For each existing product set, call `meta_ads_catalog_get_product_set_products` with its
`product_set_id` and the same field list. Paginate with the returned `page_info.after_cursor`.
```

Use this data alongside a user-supplied Ads Manager product-ID performance export. Do not claim
that the catalog MCP produced spend, purchases, or ROAS.

### Step 1: Data Acquisition

Ask the user for a product-ID performance export from Ads Manager or another source that can be
joined to `product_id`/`retailer_id`. If the export has no stable product identifier, stop before
tier classification because the join would be unreliable.

**Required data per product:**

| Field | Source | Purpose |
|-------|--------|---------|
| Product ID | Catalog | Unique identifier |
| Product name | Catalog | Human-readable name |
| Product category | Catalog | Grouping for product set analysis |
| Price | Catalog | Revenue calculation |
| Availability | Catalog | In-stock status |
| Image URL | Catalog | Feed quality check |
| Impressions | Meta Ads | Delivery volume |
| Clicks | Meta Ads | Engagement |
| Spend | Meta Ads | Investment |
| Purchases | Meta Ads | Conversion count |
| Purchase value | Meta Ads | Revenue |
| Add to cart | Meta Ads | Mid-funnel signal |
| View content | Meta Ads | Top-funnel signal |
| CTR | Calculated | Engagement rate |
| CPA | Calculated | Cost per acquisition |
| ROAS | Calculated | Return on ad spend |

**Product set data:**
- Product set name and ID
- Number of products in each set
- Set-level performance (spend, conversions, ROAS)
- Set rules (dynamic rules vs manual selection)

**Time range:** Default to last 30 days for sufficient data. If products have low volume, extend to 60 or 90 days.

### Step 2: Product Tier Classification

Classify every product into one of four tiers based on spend and return:

```
                    High ROAS
                       |
         Sidekicks     |     Heroes
        (Low spend,    |    (High spend,
         high ROAS)    |     high ROAS)
                       |
    -------------------+-------------------
                       |
         Zombies       |     Villains
        (Low spend,    |    (High spend,
         low ROAS)     |     low ROAS)
                       |
                    Low ROAS
```

**Tier definitions:**

| Tier | Spend | ROAS | Count Benchmark | Action |
|------|-------|------|-----------------|--------|
| Heroes | Top 20% by spend | Above target ROAS | ~20% of products | Protect and scale. Ensure always in stock. Increase bids. |
| Sidekicks | Bottom 80% by spend | Above target ROAS | ~30% of products | Promote more. Test in dedicated product sets. Improve feed data. |
| Zombies | Bottom 80% by spend | Below target ROAS or zero spend | ~40% of products | Investigate feed quality. Improve titles/images. If no improvement, suppress. |
| Villains | Top 20% by spend | Below target ROAS | ~10% of products | Reduce spend immediately. Exclude from broad sets. Diagnose why ROAS is low. |

**Classification thresholds:**
- "High spend" = above median spend per product
- "High ROAS" = above the account's target ROAS from account-conventions
- Products with zero spend in the analysis period default to Zombies
- Products with fewer than 5 conversions should be classified with a "low confidence" flag

**Output table:**

| Rank | Product | Category | Tier | Spend | Revenue | ROAS | CPA | Conv | Confidence |
|------|---------|----------|------|-------|---------|------|-----|------|-----------|
| 1 | | | Hero | | | | | | High |
| 2 | | | Hero | | | | | | High |
| ... | | | | | | | | | |

### Step 3: Feed Quality Audit

Feed quality directly determines ad quality in catalog campaigns. Poor feed data means poor ads, regardless of targeting or bidding.

**Field completeness audit:**

| Field | Required | Populated % | Quality Score | Issues |
|-------|----------|-------------|---------------|--------|
| title | Yes | | | Truncated, generic, missing keywords |
| description | Yes | | | Too short, missing features/benefits |
| image_link | Yes | | | Low resolution, white background, lifestyle vs product |
| price | Yes | | | Missing, incorrect format |
| availability | Yes | | | Out of stock items still active |
| brand | Recommended | | | Missing for brand-conscious categories |
| product_type | Recommended | | | Missing or too broad |
| google_product_category | Recommended | | | Missing or incorrect mapping |
| custom_label_0-4 | Optional | | | Not utilizing for segmentation |
| sale_price | Optional | | | Sale items not flagged |
| additional_image_link | Optional | | | Only one image per product |

**Title optimization assessment:**

| Quality Level | Characteristics | Example |
|---------------|----------------|---------|
| Poor | Generic, no keywords, truncated | "Blue Shirt" |
| Acceptable | Includes brand and basic attributes | "Nike Dri-FIT Running Shirt - Blue" |
| Good | Brand + product + key attributes + size | "Nike Dri-FIT Men's Running Shirt - Royal Blue - Size L" |
| Excellent | Optimized for search and visual scanning | "Nike Dri-FIT Men's Running Shirt | Moisture-Wicking | Royal Blue | Large" |

**Image quality assessment:**

| Check | Pass Criteria | Impact |
|-------|---------------|--------|
| Resolution | Minimum 600x600px, recommended 1200x1200px | Low-res images reduce CTR by 20-30% |
| Background | Clean/white for product shots, lifestyle for consideration | Mixed backgrounds reduce visual consistency |
| Product visibility | Product fills 75%+ of frame | Small products in large frames get overlooked |
| Multiple images | 3+ images per product | More images = higher engagement |
| Format consistency | Consistent style across catalog | Inconsistency reduces brand trust |

**Feed freshness:**

| Check | Pass Criteria |
|-------|---------------|
| Last feed update | Within 24 hours |
| Price accuracy | Matches website within last update |
| Availability accuracy | Out-of-stock items marked correctly |
| New product ingestion | New products appear within 48 hours of addition |

### Step 4: Product Set Analysis

Product sets are how you control which products appear in which campaigns. Poorly structured product sets waste budget on low-performers.

**Product set performance comparison:**

| Product Set | Products | Spend | Revenue | ROAS | CPA | Hero % | Villain % |
|-------------|----------|-------|---------|------|-----|--------|-----------|
| All Products | | | | | | | |
| [Set 1] | | | | | | | |
| [Set 2] | | | | | | | |
| ... | | | | | | | |

**Product set strategy assessment:**

| Strategy | When to Use | Products Included |
|----------|------------|-------------------|
| All Products (broad) | Prospecting, letting Meta find winners | Everything in stock |
| Best Sellers | Scaling proven winners | Heroes only |
| Category-specific | Category-level optimization | One product type/category |
| Price-tier | Different messaging by price point | Grouped by price range |
| New Arrivals | New product discovery | Products added in last 30 days |
| High-margin | Profit optimization | Products above margin threshold |
| Retargeting | ViewContent/ATC but no purchase | Products the user viewed |
| Exclusion set | Preventing waste | Villains + out-of-stock |

**Recommended product set structure:**

For most ecommerce accounts, the following structure works well:
1. **Broad prospecting set:** All products minus Villains and out-of-stock
2. **Hero scaling set:** Top 20% by ROAS for dedicated budget
3. **Retargeting set:** All products (show what the user viewed)
4. **Category sets:** For large catalogs with distinct categories
5. **Exclusion set:** Villains + out-of-stock + policy-violating products

### Step 5: Dynamic Retargeting Analysis

Analyze the retargeting funnel for catalog campaigns:

```
ViewContent -> AddToCart -> InitiateCheckout -> Purchase
```

**Funnel analysis:**

| Stage | Events (30d) | % of ViewContent | Cost/Event | Trend |
|-------|-------------|-----------------|------------|-------|
| ViewContent | | 100% | | |
| AddToCart | | | | |
| InitiateCheckout | | | | |
| Purchase | | | | |

**Key metrics:**

| Metric | Value | Benchmark | Status |
|--------|-------|-----------|--------|
| VC to ATC rate | | 8-15% | |
| ATC to Purchase rate | | 30-50% | |
| VC to Purchase rate | | 2-5% | |
| Retargeting window | | 7-14 days optimal | |
| Retargeting frequency | | <5 per 7 days | |

**Retargeting optimization opportunities:**

| Signal | Issue | Fix |
|--------|-------|-----|
| High VC, low ATC | Product pages not compelling | Improve product pages, pricing, or reviews |
| High ATC, low purchase | Checkout friction | Optimize checkout flow, add trust signals |
| High frequency, low conversion | Ad fatigue in retargeting | Rotate creative, tighten retargeting window |
| Long time-to-purchase | Extended consideration cycle | Extend retargeting window, add mid-funnel touchpoints |

---

## Checkpoint: Present Product Tier Breakdown

Before generating the full report, present the tier summary:

```
Product Tier Classification Summary
=====================================

Account: [Account Name]
Catalog Size: [X products]
Products with Spend: [X products]
Analysis Period: [Date Range]

Tier Breakdown:
  Heroes:    [X] products ([XX]% of spend, [XX]% of revenue)
  Sidekicks: [X] products ([XX]% of spend, [XX]% of revenue)
  Zombies:   [X] products ([XX]% of spend, [XX]% of revenue)
  Villains:  [X] products ([XX]% of spend, [XX]% of revenue)

Feed Quality Score: [X/10]
Top Optimization Opportunity: [brief description]
```

**Wait for user confirmation before generating the full report.**

---

### Step 6: Output

```markdown
# Catalog Performance Report

**Account:** [Name] | **Catalog Size:** [X products]
**Period:** [Date Range]
**Report Date:** [Today]

## Executive Summary

[2-3 sentences: catalog health, biggest opportunity, most urgent fix]

## Product Tier Classification

### Summary

| Tier | Products | % of Catalog | Spend | Revenue | ROAS | Action |
|------|----------|-------------|-------|---------|------|--------|
| Heroes | | | | | | Scale |
| Sidekicks | | | | | | Promote |
| Zombies | | | | | | Fix or suppress |
| Villains | | | | | | Reduce/exclude |

### Top 10 Heroes
[Table: product, category, spend, revenue, ROAS, CPA]

### Top 10 Villains (Highest Priority to Fix)
[Table: product, category, spend, revenue, ROAS, CPA, likely cause]

### Sidekick Opportunities (Highest Upside)
[Table: top 10 sidekicks with potential if promoted]

## Feed Quality Report

### Overall Score: [X/10]

| Dimension | Score | Issues | Priority |
|-----------|-------|--------|----------|
| Field completeness | /10 | | |
| Title quality | /10 | | |
| Image quality | /10 | | |
| Price accuracy | /10 | | |
| Availability accuracy | /10 | | |

### Critical Feed Issues
[List of specific issues that need immediate fixing]

### Feed Optimization Recommendations
[Prioritized list of feed improvements with expected impact]

## Product Set Performance

[Product set comparison table from Step 4]

### Recommended Product Set Structure
[Proposed product set architecture with rationale]

## Dynamic Retargeting Funnel

[Funnel analysis from Step 5]

### Retargeting Optimization Recommendations
[Prioritized list]

## Action Plan

### P0: Fix This Week (Revenue at Risk)
1. [Action] - [Products affected] - [Expected impact]

### P1: Fix This Month (Growth Opportunity)
1. [Action] - [Products affected] - [Expected impact]

### P2: Ongoing Optimization
1. [Action] - [Cadence] - [Expected impact]

## Appendix: Full Product Tier CSV

[Instruction to export full product-level data as CSV for merchandising team]

Columns: product_id, product_name, category, tier, spend, revenue, roas, cpa, conversions, impressions, ctr, confidence_level
```

---

## Execution Capability

This skill analyzes catalog structure and performance. Treat catalog, feed, and product-set changes
as recommendations to perform in Commerce Manager; do not claim that this workflow has created or
updated them.

### Execution vs Analysis

| Action | Execution Method | Requires Human Approval? |
|--------|-----------------|--------------------------|
| List catalogs and product sets | `meta_ads_catalog_get_catalogs`, `meta_ads_catalog_get_product_sets` | No approval needed (read-only) |
| Get catalog settings | `meta_ads_catalog_get_details` | No approval needed (read-only) |
| List catalog-wide products | `meta_ads_catalog_search_product` with a filter | No approval needed (read-only) |
| List products in a set | `meta_ads_catalog_get_product_set_products` | No approval needed (read-only) |
| Create or rename a catalog | Commerce Manager | Cannot execute in this workflow |
| Update product data | Source feed or Commerce Manager | Cannot execute in this workflow |
| Sync/upload product feeds | Manual in Commerce Manager | Cannot execute via MCP -- feed ingestion must be done in Commerce Manager |
| Create product sets within a catalog | Manual in Commerce Manager or Commerce Manager API | Cannot execute directly via Meta Ads MCP |

### Step 6 Addition: Proposed Actions Queue

After the catalog report is generated and confirmed by the user, produce a manual action queue.

```
Proposed Actions -- Catalog Analysis
======================================
Review each action below. Confirm to execute, skip, or modify.

[ ] Action 1: Update catalog name for clarity
    Manual action: Commerce Manager > Catalog > Settings
    Catalog ID: {catalog_id}
    New name: "{Brand} -- Main Product Catalog"
    Reason: Current name is generic; updating for account hygiene
    Status: MANUAL

[ ] Action 2: (Not executable via MCP) Create "Heroes Only" product set
    Manual action required: Commerce Manager > Catalog > Product Sets > Create
    Rule: ROAS >= {target_roas} AND availability = in_stock
    Reason: No dedicated Hero product set exists; needed to isolate top performers
    Status: MANUAL -- must be done in Commerce Manager

[ ] Action 3: (Not executable via MCP) Remove 14 out-of-stock products from "All Products" set
    Manual action required: Update product set rules to filter availability = in_stock
    Reason: Out-of-stock Villains are receiving spend in the broad prospecting set
    Status: MANUAL -- must be done in Commerce Manager
```

Do not claim manual actions were completed. Ask the user to confirm the resulting state before
using it in a later analysis.

---

## Quick Reference: Product Tier Actions

| Tier | Budget Action | Feed Action | Creative Action | Merchandising Action |
|------|--------------|-------------|----------------|---------------------|
| Heroes | Increase bid, dedicate budget | Maintain quality, add images | Feature in static ads too | Ensure stock, feature on site |
| Sidekicks | Test in dedicated set | Improve titles, add images | Test as hero candidates | Consider promotions |
| Zombies | Suppress if no improvement | Fix titles, images, descriptions | N/A (no spend to optimize) | Review pricing, positioning |
| Villains | Exclude from broad sets | Check price, images, description | Stop wasting spend | Investigate: is the product the problem? |
