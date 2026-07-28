# Data Requirements: audit-structure

## MCP Tool Calls

### Primary: All Campaigns (Active + Paused)

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
    - created_time
  filtering:
    - field: "campaign.effective_status"
      operator: "IN"
      value: ["ACTIVE", "PAUSED"]
```

**Purpose:** Full campaign inventory including paused campaigns (paused campaigns still count as structural complexity and may be reactivated).

### Secondary: All Ad Sets

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
    - targeting
    - optimization_goal
    - bid_strategy
    - daily_budget
    - lifetime_budget
    - issues_info
    - created_time
  filtering:
    - field: "adset.effective_status"
      operator: "IN"
      value: ["ACTIVE", "PAUSED"]
```

**Purpose:** Ad set structure for consolidation analysis, targeting for overlap detection, learning phase for viability assessment.

### Tertiary: All Active Ads

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "ad"
  fields:
    - id
    - name
    - adset_id
    - status
    - effective_status
    - created_time
  filtering:
    - field: "ad.effective_status"
      operator: "IN"
      value: ["ACTIVE"]
```

**Purpose:** Ad count per ad set for creative density assessment.

### Quaternary: Ad Set Performance (7-day)

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

**Purpose:** Conversion volume per ad set for learning phase viability calculation (50 conversions/week threshold).

## CSV Column Mappings

| API Field | Ads Manager Column | Notes |
|-----------|-------------------|-------|
| campaign name | Campaign Name | |
| objective | Campaign Objective | |
| bid_strategy | Bid Strategy | |
| daily_budget | Daily Budget | |
| buying_type | Buying Type | Auction vs Reservation |
| adset name | Ad Set Name | |
| targeting | N/A | Not directly exportable -- must be screenshotted or manually recorded |
| effective_status / issues_info | Delivery blockers | Learning-stage status requires Ads Manager evidence |
| created_time | N/A | Check "Created" column if available |

### Required CSV Exports

1. **Campaign list:** All campaigns (active + paused), include Objective, Budget Type, Bid Strategy, Status, Created date
2. **Ad set list:** All ad sets, include Campaign mapping, Budget, Learning Phase status, Created date
3. **Ad set performance:** Last 7 days, include Results column
4. **Ad count:** Ad-level export, just Ad Name + Ad Set Name columns to count ads per ad set

## Derived Calculations

| Calculation | Formula | Threshold |
|------------|---------|-----------|
| Weekly conversions per ad set | sum(conversions, last 7 days) | <50 = below learning threshold |
| Minimum viable daily budget | target_cpa * 50 / 7 | Per ad set |
| Campaign count by objective | count(campaigns) grouped by objective | >5 same objective = fragmented |
| Ad set count per campaign | count(ad_sets) grouped by campaign_id | >5 (CBO) or >8 (ABO) = diluted |
| Ad count per ad set | count(ads) grouped by adset_id | >20 = too noisy, 1 = no testing |
| Naming compliance rate | compliant_entities / total_entities | <80% = partial, <50% = non-compliant |

## Naming Convention Parsing

To check naming compliance, parse entity names against the convention templates from account-conventions:

**Campaign:** `{objective}_{audience}_{geo}_{launch_date}`
- Split on `_`
- Token 1: must be in [CONV, TRAF, REACH, VV, LEAD, CATALOG]
- Token 2: must be in [PROS, RT, ASC, LAL]
- Token 3: must be a valid geo code
- Token 4: must match YYYY-MM format

**Ad Set:** `{targeting}_{placement}_{bid_strategy}_{budget}`
- Token validation per naming_conventions definition

**Ad:** `{creative_type}_{concept}_{variant}_{format}`
- Token validation per naming_conventions definition

## Minimum Data Requirements

| Metric | Minimum for Analysis |
|--------|---------------------|
| Active campaigns | 1 (but audit is most valuable with 3+) |
| Active ad sets | 2 |
| Days of performance data | 7 |
| Account age | 14+ days (too early before that) |
