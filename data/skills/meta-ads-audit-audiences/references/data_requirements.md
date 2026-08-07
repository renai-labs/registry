# Data Requirements: audit-audiences

## MCP Tool Calls

### Primary: Ad Set-Level Insights (14-day, daily)

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "adset"
  date_preset: "last_14d"
  time_increment: "1"
  fields:
    - id
    - name
    - campaign_id
    - impressions
    - reach
    - frequency
    - clicks
    - ctr
    - cpc
    - cpm
    - amount_spent
    - results
    - cost_per_result
```

**Purpose:** Core performance data for saturation analysis, frequency trends, and CPM trend detection.

### Secondary: Ad Set Targeting Details

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "adset"
  fields:
    - id
    - name
    - status
    - effective_status
    - targeting
    - optimization_goal
    - bid_strategy
    - daily_budget
    - lifetime_budget
  filtering:
    - field: "adset.effective_status"
      operator: "IN"
      value: ["ACTIVE"]
```

**Purpose:** Targeting specs for overlap analysis. The `targeting` field contains custom audiences, interests, demographics, geo, and Advantage+ settings.

### Tertiary: Custom Audience Details

```
MCP tool: `meta_ads_get_ad_account_custom_audiences`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  cursor: {next_cursor}  # Omit on first call
```

**Purpose:** Audience sizes for penetration calculations, audience freshness for exclusion audit.

### Quaternary: Campaign-Level Data

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "campaign"
  date_preset: "last_14d"
  fields:
    - id
    - name
    - impressions
    - reach
    - frequency
    - amount_spent
    - results
    - cost_per_result
```

**Purpose:** Campaign-level reach and frequency for funnel mapping.

### Advantage+ Audience Breakdown

The MCP does not expose the defined-versus-expanded audience split. Export it manually from Ads
Manager when required and label it unavailable when no export is supplied.

## CSV Column Mappings

| API Field | Ads Manager Column | Notes |
|-----------|-------------------|-------|
| adset_name | Ad Set Name | |
| campaign_name | Campaign Name | |
| impressions | Impressions | |
| reach | Reach | |
| frequency | Frequency | |
| clicks | Link Clicks | |
| ctr | CTR (Link) | |
| cpm | CPM | |
| spend | Amount Spent | |
| results | Results | Follows the campaign objective |
| cost_per_result | Cost per Result | Follows the campaign objective |

### Required CSV Exports

1. **Ad set performance:** Ad set level, last 14 days, daily breakdown
2. **Targeting details:** Not directly exportable -- user must screenshot or list targeting per ad set from Ads Manager
3. **Custom audiences:** Audiences section > export audience list with sizes

## Targeting Field Structure

The `targeting` object from `get_adsets` contains:

```json
{
  "targeting": {
    "age_min": 25,
    "age_max": 55,
    "genders": [0],
    "geo_locations": {
      "countries": ["US"],
      "regions": [],
      "cities": []
    },
    "custom_audiences": [
      {"id": "12345", "name": "LAL 1% LTV"}
    ],
    "excluded_custom_audiences": [
      {"id": "67890", "name": "Purchasers 180d"}
    ],
    "flexible_spec": [
      {
        "interests": [
          {"id": "6003", "name": "Fitness"}
        ]
      }
    ],
    "targeting_optimization": "expansion_all",
    "publisher_platforms": ["facebook", "instagram"],
    "device_platforms": ["mobile", "desktop"]
  }
}
```

Parse `custom_audiences` for overlap detection, `excluded_custom_audiences` for exclusion audit, `flexible_spec` for interest overlap, and `targeting_optimization` for Advantage+ status.

## Minimum Data Requirements

| Metric | Minimum for Analysis |
|--------|---------------------|
| Active ad sets | 3 (overlap analysis needs pairs) |
| Days of data | 7 (14 preferred for trends) |
| Total account spend | $1,000/week |
| Custom audiences | At least 1 (for exclusion audit) |
