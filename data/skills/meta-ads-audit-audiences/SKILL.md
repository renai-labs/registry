---
name: meta-ads-audit-audiences
description: Audits audience strategy for Meta Ads accounts. Identifies audience overlap, saturation signals, expansion opportunities, and Advantage+ audience performance. Produces an audience health report with recommendations. Use when asked to audit or review audiences or targeting strategy, or to check audience overlap, saturation, or audience health.
---

# Audit Audiences

## How to Call Meta Ads Tools

Call the mounted `meta_ads_*` MCP tools directly. Do not write a Python wrapper.

Verify entity fields with `meta_ads_get_field_context`, then use `meta_ads_get_ad_entities` with a
numeric `ad_account_id` and fields containing `id` and `name`. Use
`meta_ads_get_ad_account_custom_audiences` for readable audience inventory.

The current MCP cannot calculate audience overlap, estimate reach, create custom or lookalike
audiences, or upload audience members. Treat those as manual Ads Manager actions and never claim
they were executed.

## Purpose

Execute a structured audience strategy audit for a Meta Ads account. This skill identifies audience overlap and cannibalization, detects saturation signals before they impact CPA, evaluates Advantage+ audience behavior, audits exclusion hygiene, and surfaces expansion opportunities. It produces an audience health report with a prioritized action list.

## When to Use

- CPA rising across multiple ad sets (may be overlap or saturation, not creative)
- Reach is plateauing despite available budget
- Scaling an account and need to identify next audiences
- Quarterly audience strategy review
- New account onboarding to assess targeting architecture
- When Advantage+ audiences are enabled and you need to understand what Meta is actually targeting

## Dependencies

| Skill | Why It's Needed |
|-------|----------------|
| [[meta-ads-account-conventions]] | Account config: audience_config, KPI targets, naming conventions, capability flags |
| [[meta-ads-audience-methodology]] | Overlap thresholds, saturation signals, LAL best practices, Advantage+ guidelines |
| [[meta-ads-account-maturity-methodology]] | Calibrates audience complexity -- nascent accounts use simpler structures |

---

## Step 0: Load Dependencies

1. **Read [[meta-ads-account-conventions]]** and extract for the target account:
   - `ad_account_id`, `currency`, `timezone`
   - `kpi_config` (targets and flag thresholds)
   - `audience_config` (warm audiences, exclusion audiences, LAL sources, Advantage+ status)
   - `naming_conventions.ad_set` (parse targeting, placement, bid strategy from ad set names)
   - `capabilities` (has_advantage_plus, campaign_types_active)
   - `data_source.method`
   - `compliance` (special_ad_categories -- restricts targeting options)

2. **Read [[meta-ads-audience-methodology]]** and load:
   - Overlap threshold definitions (>30% = high overlap)
   - Saturation signal framework
   - Lookalike audience best practices by maturity
   - Advantage+ audience evaluation criteria
   - Exclusion best practices

3. **Read [[meta-ads-account-maturity-methodology]]** and determine:
   - Maturity level and recommended audience complexity
   - Nascent: broad + LAL only. Developing: add interest stacking. Established: full funnel segmentation. Advanced: Advantage+ with guardrails.

**Validation gate:** If `ad_account_id` is missing, stop. If `audience_config` is empty, note that the audit will be based on live data only (no baseline to compare against).

---

## Step 1: Data Acquisition

### Ad Set-Level Performance Data

```
MCP tool: `meta_ads_get_ad_entities`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  level: "adset"
  date_preset: "last_14d"
  time_increment: "1"  # Daily for trend detection
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

### Ad Set Targeting Details

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

### Custom Audience Details (if accessible)

```
MCP tool: `meta_ads_get_ad_account_custom_audiences`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  cursor: {next_cursor}  # Omit on the first call
```

### Campaign-Level Data (for funnel mapping)

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

### CSV Fallback

If data_source.method = "csv", instruct the user to export:
1. Ad set-level report with targeting details, last 14 days, daily breakdown
2. Custom audience list from Audiences section in Ads Manager
3. Campaign-level report, last 14 days

---

## Step 2: Audience Overlap Analysis

### Map All Active Audiences

For each active ad set, extract targeting details:
- Custom audiences included
- Lookalike audiences (source, percentage)
- Interest targeting (categories, behaviors, demographics)
- Geo targeting
- Age/gender targeting
- Advantage+ audience expansion settings

### Overlap Detection

Compare every pair of active ad sets for potential overlap:

| Overlap Type | Detection Method | Threshold |
|-------------|-----------------|-----------|
| Same custom audience | Direct audience ID comparison | Any match = overlap |
| Overlapping LALs | Same source audience, overlapping % ranges | LAL 1% and LAL 3% from same source = high overlap |
| Interest overlap | Shared interest categories | >50% shared interests = high overlap |
| Geo + demo overlap | Same geo, same age/gender, different interests | Flag if interests also overlap >30% |
| Broad vs specific | One ad set is broad, another targets subset | Broad always overlaps with specific |

### Overlap Severity Scoring

- **Critical (Red):** Same custom audience in multiple ad sets, or >70% estimated overlap. These ad sets are competing against each other in the auction, driving up CPMs.
- **High (Orange):** 50-70% estimated overlap. Consolidation recommended.
- **Moderate (Yellow):** 30-50% overlap. Monitor, consider consolidation if performance diverges.
- **Low (Green):** <30% overlap. Healthy differentiation.

### Auction Competition Impact

When two ad sets from the same account target the same user, Meta runs them against each other in the auction. This:
- Increases your effective CPM (you bid against yourself)
- Splits conversion data across ad sets (slower learning)
- Makes it harder to identify what's actually working

Estimate the CPM tax: for each overlap pair, compare their CPMs to non-overlapping ad sets. Higher CPMs in overlapping pairs confirm auction self-competition.

---

## Step 3: Saturation Analysis

### Frequency Trends

For each ad set, calculate:
- 7-day average frequency
- Frequency trend (increasing, stable, decreasing)
- Frequency by day (detect acceleration)

**Saturation thresholds (from audience-methodology):**

| Campaign Type | Healthy | Warning | Saturated |
|--------------|---------|---------|-----------|
| Prospecting (broad) | <2.0 | 2.0-3.0 | >3.0 |
| Prospecting (LAL/interest) | <2.5 | 2.5-4.0 | >4.0 |
| Retargeting (warm) | <5.0 | 5.0-8.0 | >8.0 |
| Retargeting (hot) | <7.0 | 7.0-12.0 | >12.0 |

### Reach vs Audience Size

For each ad set:
- Estimated audience size (from targeting spec)
- Total reach in period
- Reach penetration = reach / audience size
- If reach penetration >60% in 14 days: saturation risk

### CPM Trend Analysis

Rising CPMs with stable or declining CTR indicate the algorithm is running out of cheap impressions within the audience:
- CPM increase >20% WoW with stable targeting = saturation signal
- CPM increase with frequency increase = confirmed saturation

### Conversion Rate Decay

- Track conversion rate (conversions / clicks) by day
- Declining conversion rate at stable frequency = audience quality decay (the best prospects converted already)

---

## Step 4: Advantage+ Audience Analysis

**Skip this section if `capabilities.has_advantage_plus` is false.**

### Audience Expansion Behavior

When Advantage+ audience is enabled, Meta can expand beyond your defined targeting. Analyze:

- What percentage of impressions went to the defined audience vs expansion?
- Compare CPA for defined audience vs expanded audience
- Compare CTR and conversion rate for each segment

### Advantage+ Evaluation

The MCP does not expose a defined-versus-expanded audience breakdown. Request that breakdown from
Ads Manager when the distinction is required. Without it, report total ad-set performance and
label expansion-specific conclusions unavailable rather than inferring them.

### Decision Framework

| Scenario | Recommendation |
|----------|---------------|
| Expanded CPA < Defined CPA | Advantage+ is finding efficient pockets. Keep enabled, consider broadening suggestions. |
| Expanded CPA within 20% of Defined | Acceptable. Meta is expanding responsibly. |
| Expanded CPA > 20% above Defined | Expansion is inefficient. Tighten audience suggestions or add negative audiences. |
| >70% spend going to expansion | Suggestions are too narrow or Meta is ignoring them. Review suggestion quality. |

---

## Step 5: Exclusion Audit

### Purchaser/Converter Exclusions

For every prospecting campaign, verify:
- Purchaser/converter exclusion audience is applied
- Exclusion audience is up to date (check `time_updated`)
- Exclusion audience size is reasonable (if you have 10K customers but exclusion shows 500, something is wrong)
- Match rate check: customer list audiences should have >50% match rate

### Cross-Campaign Exclusion Check

| Campaign Type | Should Exclude |
|--------------|----------------|
| Prospecting (broad) | All purchasers, all retargeting audiences |
| Prospecting (LAL) | All purchasers |
| Retargeting (warm) | Purchasers (last 30-180d depending on purchase cycle) |
| Retargeting (hot - ATC/IC) | Recent purchasers (last 7-30d) |
| ASC | Cannot apply manual exclusions (Meta handles) |

### Missing Exclusions Report

Flag any prospecting ad set that is NOT excluding:
- Existing purchasers/converters
- Email subscriber list (if lead gen)
- Current retargeting audiences (to prevent double-serving)

Estimate wasted spend: (overlap reach * average CPC) gives a rough cost of serving ads to people who should be excluded.

---

## Step 6: Expansion Opportunities

### Underexplored Audience Segments

Based on current targeting and performance data, identify:

1. **New LAL sources:** Which high-value custom audiences aren't being used as LAL seeds?
   - Top purchasers by LTV
   - High-engagement website visitors
   - Video viewers (75%+ completion)
   - Email openers/clickers

2. **LAL percentage expansion:** If LAL 1% is working, has 2-3% been tested?

3. **Interest/behavior expansion:** Adjacent interests not currently targeted

4. **Geo expansion:** If running in one market, which markets have similar audience profiles?

5. **Demographic expansion:** Are age/gender restrictions limiting reach unnecessarily?

### Audience Testing Priorities

Rank expansion opportunities by:
- Estimated audience size
- Proximity to working audiences (similar signals)
- Competitive gap (audiences competitors likely target that you don't)
- Data availability (do you have a seed audience to build from?)

### Advantage+ Shopping Campaigns (ASC) Assessment

If not using ASC and the account is Established or Advanced maturity:
- Recommend testing ASC with a subset of budget
- ASC uses Meta's full signal graph (no manual targeting needed)
- Set minimum ROAS or cost cap guardrails

---

## Checkpoint: Present Findings

```
Audience Audit Summary for {account_name}
Period: {date_range}

Active Ad Sets Analyzed: {count}
Custom Audiences in Use: {count}

Overlap Assessment:
- Critical overlap pairs: {count}
- High overlap pairs: {count}
- Estimated CPM tax from self-competition: ~{amount}/month

Saturation Assessment:
- Saturated ad sets: {count} (reaching >60% of audience)
- Warning ad sets: {count} (frequency trending up)
- Healthy ad sets: {count}

Exclusion Health:
- Ad sets missing purchaser exclusion: {count}
- Estimated wasted spend on already-converted users: ~{amount}/month

Advantage+ Status: {enabled/disabled}
- Expansion efficiency: {CPA comparison}

Expansion Opportunities Found: {count}

Key Flags:
- {critical findings}

Shall I generate the full audience health report with recommendations?
```

---

## Step 7: Output Generation

### Deliverable 1: Audience Health Report

```markdown
# Audience Health Report: {account_name}
Generated: {date} | Period: {date_range}

## Executive Summary
{2-3 sentence summary of audience health, biggest risk, biggest opportunity}

## Audience Map
| Ad Set | Campaign | Targeting Type | Audience Size | Reach | Penetration | Frequency | CPA | Status |
|--------|----------|---------------|---------------|-------|-------------|-----------|-----|--------|
| ...    | ...      | LAL 1% - LTV  | 2.1M          | 890K  | 42%         | 2.3       | $48 | Healthy|

## Health Scores by Ad Set
| Ad Set | Overlap Score | Saturation Score | Exclusion Score | Overall |
|--------|--------------|------------------|-----------------|---------|
| ...    | Green        | Yellow           | Red             | Warning |
```

### Deliverable 2: Overlap Matrix

```markdown
## Overlap Matrix
| | Ad Set A | Ad Set B | Ad Set C | Ad Set D |
|---|---------|---------|---------|---------|
| Ad Set A | -- | 65% (Critical) | 12% (Low) | 38% (Moderate) |
| Ad Set B | 65% | -- | 45% (High) | 8% (Low) |
| Ad Set C | 12% | 45% | -- | 5% (Low) |
| Ad Set D | 38% | 8% | 5% | -- |

### Consolidation Recommendations
1. **Merge Ad Set A + Ad Set B** -- 65% overlap, competing in auction. Consolidate into single ad set using the better-performing targeting. Estimated CPM savings: ~$X/month.
2. ...
```

### Deliverable 3: Consolidation Recommendations

For each consolidation or restructuring recommendation:
- Which ad sets to merge or restructure
- Which targeting to keep (the better performer)
- Estimated impact on CPA and reach
- Implementation steps (pause one, increase budget on other, etc.)
- Risk assessment and rollback plan

### Deliverable 4: Expansion Opportunities

```markdown
## Expansion Opportunities (Prioritized)

### Tier 1: High Confidence (Test This Week)
| Opportunity | Type | Est. Audience Size | Why | Recommended Budget |
|-------------|------|-------------------|-----|-------------------|
| LAL 3% from top LTV | LAL expansion | 6.3M | LAL 1% CPA at $42, room to scale | $100/day for 7 days |

### Tier 2: Medium Confidence (Test Next Sprint)
| ... |

### Tier 3: Exploratory (Requires More Data)
| ... |

### Not Recommended
| Opportunity | Why Not |
|-------------|---------|
| ... | ... |
```

---

## Error Handling

| Issue | Detection | Resolution |
|-------|----------|------------|
| Cannot access targeting details | MCP returns partial ad set data | Fall back to naming convention parsing. If naming conventions not set, ask user to export targeting details manually. |
| Custom audience sizes unavailable | API returns null for approximate_count | Use reach as a proxy. Note reduced confidence in penetration calculations. |
| Advantage+ breakdown unavailable | audience_type breakdown not returned | Note that Advantage+ analysis is limited. Recommend checking Ads Manager directly for expansion metrics. |
| Special ad categories active | compliance.special_ad_categories != "none" | Flag that certain targeting options (age, gender, interests) are restricted. Skip those sections of expansion analysis. |
| Too few ad sets (<3) | Limited data for overlap analysis | Note that overlap analysis is limited. Focus on saturation and exclusion audit instead. |
| No custom audiences configured | audience_config is empty | Recommend building foundational audiences (website visitors, purchasers, email list) before advanced audience strategy. |
| Account uses only ASC | No manual targeting to audit | Pivot to ASC-specific analysis. Check performance by audience segment within ASC. Recommend running audit-structure to assess if the all-ASC approach is appropriate. |

---

## Execution Capability

After generating the audience health report, this skill can produce a manual implementation plan.
No audience changes execute through the current MCP.

### Execution vs Analysis

| Action | Execution Method | Requires Human Approval? |
|--------|-----------------|--------------------------|
| Create new website/CRM custom audience | Ads Manager | Cannot execute via MCP |
| Create new LAL from best-performing source | Ads Manager | Cannot execute via MCP |
| Check overlap between audiences | Ads Manager Audience Overlap | Cannot execute via MCP |
| Validate audience size before launching | Ads Manager estimated audience | Cannot execute via MCP |
| Upload hashed CRM list | Ads Manager or an approved CRM integration | Cannot execute via MCP |
| Creating lead forms | Manual in Ads Manager | Cannot execute via MCP |
| Managing CRM integrations (Shopify sync, etc.) | Manual in Commerce Manager | Cannot execute via MCP |
| Merging/consolidating existing ad sets | Manual in Ads Manager | Cannot execute via MCP |

### Step 8: Proposed Actions Queue

After Step 7 output is generated and confirmed by the user, produce a manual action queue. Do not
claim any item was completed until the user confirms it.

```
Proposed Actions -- Audience Audit
===================================
Review each action below and confirm to execute, skip, or modify.

[ ] Action 1: Create website custom audience -- "{Brand} -- All Visitors 30d"
    Manual action: Ads Manager > Audiences
    Type: WEBSITE
    Retention: 30 days
    Rule: All website visitors
    Reason: Missing purchaser exclusion base; needed before any exclusion can be applied
    Status: MANUAL

[ ] Action 2: Create LAL -- "{Brand} -- 1% LAL from LTV Top Purchasers"
    Manual action: Ads Manager > Audiences
    Source audience ID: {best_source_audience_id}
    Country: US
    Ratio: 0.01 (1%)
    Reason: LAL 1% from LTV segment not currently in use; Tier 1 expansion opportunity
    Status: MANUAL

[ ] Action 3: Check overlap -- LAL 1% vs LAL 3% from same source
    Manual action: Ads Manager > Audiences > Show Audience Overlap
    Audience IDs: [{lal_1pct_id}, {lal_3pct_id}]
    Reason: Validate overlap before running both audiences simultaneously
    Status: MANUAL

[ ] Action 4: Validate reach -- New interest stack "AI Enthusiasts"
    Manual action: Ads Manager audience estimate
    Targeting spec: {targeting_spec_json}
    Reason: Confirm audience is >500K before launching
    Status: MANUAL

[ ] Action 5: Upload CRM list -- 4,200 email contacts for exclusion
    Manual action: Ads Manager or approved CRM integration
    Audience ID: {customer_exclusion_audience_id}
    Data type: EMAIL_SHA256
    Reason: Exclusion audience is 60 days stale; upload current customer list
    Status: MANUAL
```

**Only proceed with each action after explicit user confirmation per item.**

---

## Reference Files

- `references/data_requirements.md` -- Complete list of MCP tool calls, API fields, CSV column mappings for audience data
- `references/output_specs.md` -- Exact markdown templates for audience health report, overlap matrix, and expansion opportunities
- `references/worked_example.md` -- End-to-end walkthrough auditing a $100K/month account with 8 ad sets and 3 LAL sources
