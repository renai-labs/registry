# Data Requirements: audit-bidding

## MCP Tool Calls

### Primary: Campaign-Level Insights (14-day, daily)

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "campaign"
  date_preset: "last_14d"
  time_increment: "1"
  fields:
    - id
    - name
    - impressions
    - reach
    - amount_spent
    - conversions
    - cost_per_result
    - cpm
    - cpc
    - ctr
```

**Purpose:** Daily spend and CPA data for volatility analysis, performance vs strategy assessment, and trend detection.

### Secondary: Campaign Configuration

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "campaign"
  fields:
    - id
    - name
    - status
    - effective_status
    - objective
    - bid_strategy
    - daily_budget
    - lifetime_budget
    - buying_type
  filtering:
    - field: "campaign.effective_status"
      operator: "IN"
      value: ["ACTIVE"]
```

**Purpose:** Campaign objectives and bid strategies for strategy-fit assessment.

### Tertiary: Ad Set-Level Performance

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "adset"
  date_preset: "last_7d"
  fields:
    - id
    - name
    - campaign_id
    - impressions
    - amount_spent
    - results
    - cost_per_result
```

**Purpose:** Ad set conversion velocity for learning phase analysis.

### Quaternary: Ad Set Configuration

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "adset"
  fields:
    - id
    - name
    - campaign_id
    - status
    - effective_status
    - optimization_goal
    - bid_strategy
    - daily_budget
    - lifetime_budget
    - issues_info
  filtering:
    - field: "adset.effective_status"
      operator: "IN"
      value: ["ACTIVE"]
```

**Purpose:** Bid strategy details at ad set level (for ABO campaigns) and learning phase status.
The entity surface does not expose `bid_amount`; obtain cap or bid amounts from the Ads Manager
ad-set export before judging whether a control is too tight or loose.

## CSV Column Mappings

| API Field | Ads Manager Column | Notes |
|-----------|-------------------|-------|
| campaign_name | Campaign Name | |
| bid_strategy | Bid Strategy | May show as "Lowest Cost", "Cost Cap", "Bid Cap", "Minimum ROAS" |
| bid_amount | Bid/Cost Control Amount | Only present for Cost Cap and Bid Cap |
| daily_budget | Daily Budget | |
| spend | Amount Spent | |
| results | Results | Follows the campaign objective |
| cost_per_result | Cost per Result | Follows the campaign objective |
| effective_status / issues_info | Delivery blockers | Does not prove learning-stage status |

### Required CSV Exports

1. **Campaign-level:** Last 14 days, daily breakdown, include Budget, Bid Strategy, Delivery columns
2. **Ad set-level:** Last 7 days, include Bid Strategy, Bid Amount, Delivery (learning phase), Budget

## Bid Strategy Field Values

The `bid_strategy` field returns these values:

| API Value | Display Name | Description |
|-----------|-------------|-------------|
| LOWEST_COST_WITHOUT_CAP | Lowest Cost | Auto-bid, maximize conversions within budget |
| LOWEST_COST_WITH_BID_CAP | Bid Cap | Hard ceiling on per-auction bid |
| COST_CAP | Cost Cap | Average CPA target (can exceed on individual auctions) |
| LOWEST_COST_WITH_MIN_ROAS | Minimum ROAS | Floor on return, only for value optimization |
| TARGET_COST | Target Cost | Deprecated, legacy strategy |

## Learning Phase Status

The MCP does not expose a reliable learning-stage field. Use `effective_status` and `issues_info`
for delivery blockers, and mark learning status not verified unless the user supplies Ads Manager
evidence. Low conversion velocity may justify caution but must not be relabeled as a Meta status.

## Minimum Data Requirements

| Metric | Minimum for Analysis |
|--------|---------------------|
| Active campaigns | 2 |
| Days of data | 7 (14 preferred for volatility analysis) |
| Total account spend | $500/week |
| Campaigns with conversions | At least 1 |
