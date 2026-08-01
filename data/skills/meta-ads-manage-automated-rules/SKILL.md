---
name: meta-ads-manage-automated-rules
description: Audits existing Meta Ads automated rules, identifies gaps in campaign protection, proposes new guardian rules for kill switches, budget pacing, creative fatigue, and scale triggers, and creates/updates rules with human approval before any changes execute. Use when asked to set up, check, or manage automated rules, guardian rules, kill switches, budget or pacing rules, creative fatigue alerts, or scale triggers. Do NOT use to change budgets directly, which is [[meta-ads-optimize-budgets]].
metadata:
  icon: "https://cdn.renai.build/skill-icons/meta.png"
---

# Manage Automated Rules

## How to Call Meta Ads Tools

Call the mounted `meta_ads_*` MCP tools directly. Do not write a Python wrapper.

- `meta_ads_adrule_list` lists rules for a numeric `ad_account_id` without the `act_` prefix. Follow
  `next_cursor` until the requested scope is covered.
- `meta_ads_adrule_get_history` reads execution history for one `rule_id`; follow its cursor when
  needed.
- `meta_ads_adrule_create` creates a disabled rule by default. Its `evaluation_spec`,
  `execution_spec`, and `schedule_spec` inputs are JSON strings.
- `meta_ads_adrule_update` mutates a rule immediately and can enable, disable, or delete it.

Treat a disabled created rule as the review layer. Present the complete rule and obtain approval
before creation; read it back after creation; then obtain separate approval before enabling it.
Updates take effect immediately. Budget and bid amounts use the smallest unit of the account
currency.

## Purpose

Meta Ads automated rules run 24/7 to protect campaign performance, enforce budget discipline, and trigger scaling actions -- without requiring manual Ads Manager monitoring. This skill audits your existing rule coverage, identifies gaps, and creates a prioritized ruleset of "guardian rules" to protect every active campaign.

Treat all proposed rules as plans until explicitly approved. Never create or modify rules
autonomously.

## When to Use This Skill

- New account setup: establish a baseline ruleset from scratch
- Post-launch: add guardian rules after campaigns go live
- Weekly review: check if existing rules are firing correctly (or not at all)
- Incident response: a campaign overspent or paused unexpectedly -- audit rules to find the cause
- Scaling phase: add scale triggers when campaigns are performing above target

## Required Inputs

- **Account:** Which ad account (from [[meta-ads-account-conventions]] roster)
- **Scope:** All campaigns, or specific campaigns/ad sets?
- **KPI config:** CPA targets, ROAS targets, budget pacing expectations (from account-conventions)
- **Priority:** Which rule categories to focus on first (kill switches, pacing, fatigue, scale)?

---

## Execution Model

### Step 1: Load Account Configuration

Read [[meta-ads-account-conventions]] and extract:
- `ad_account_id`
- `kpi_config`: target CPA, target ROAS, budget thresholds
- `campaign_types_active`: which types of campaigns are running
- `maturity_level`: affects which rules are appropriate at this stage

### Step 2: List All Existing Rules

```
MCP tool: `meta_ads_adrule_list`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  cursor: {next_cursor}  # Omit on the first call
```

For each rule returned, capture:
- `rule_id`
- `name`
- `status` (ENABLED, DISABLED, DELETED)
- `evaluation_spec` (what conditions trigger the rule)
- `execution_spec` (what action the rule takes)
- `schedule_spec` (how often the rule evaluates)
- `entity_type` (CAMPAIGN, ADSET, AD, or AD_ACCOUNT)
- Campaigns/ad sets/ads the rule is applied to

Present a rules inventory:

```
Existing Rules Inventory
=========================
Account: {name}
Total rules found: {count}

| # | Name | Status | Entity | Trigger | Action | Applied To |
|---|------|--------|--------|---------|--------|------------|
| 1 | {name} | ENABLED | ADSET | CPA > $X | PAUSE | All ad sets |
| 2 | {name} | DISABLED | CAMPAIGN | Spend > $Y | Notify | 3 campaigns |
```

### Step 3: Check Rule Execution History

For each active rule, check when it last fired and whether it executed correctly:

```
MCP tool: `meta_ads_adrule_get_history`
Parameters:
  rule_id: {rule_id}
  cursor: {next_cursor}  # Omit on the first call
```

Flag:
- Rules that have never fired (may be incorrectly configured or conditions never met)
- Rules that fire too frequently (threshold may be too sensitive)
- Rules that failed to execute (API error, permission issue)
- Rules that fired but should not have (threshold misconfigured)

```
Rule Execution History
=======================
| Rule | Last Fired | Times Fired (30d) | Status | Issues |
|------|-----------|-------------------|--------|--------|
| {name} | {date} | 3 | OK | None |
| {name} | Never | 0 | WARNING | Rule may be misconfigured or threshold too high |
| {name} | {date} | 47 | WARNING | Firing too frequently -- threshold may be too sensitive |
```

### Step 4: Gap Analysis

Compare existing rules against the full guardian ruleset (from `references/rule_templates.md`) to identify missing coverage.

Evaluate each active campaign against 6 rule categories:

| Category | Description | Priority |
|----------|-------------|----------|
| Kill Switches | Auto-pause when CPA/CTR/frequency exceeds threshold | P1 |
| Budget Pacing Guards | Adjust daily budget based on ROAS/CPA performance | P1 |
| Creative Fatigue Alerts | Notify when frequency exceeds safe thresholds | P2 |
| Learning Phase Protection | Alert if ad set exits learning unexpectedly | P2 |
| Spend Anomaly Alerts | Notify if daily spend deviates from expected pace | P2 |
| Scale Triggers | Increase budget when CPA is consistently below target | P3 |

For each campaign/ad set without coverage, list as a gap:

```
Gap Analysis
=============
Campaigns with NO kill switch: {list}
Campaigns with NO pacing guard: {list}
Ad sets with NO fatigue alert: {list}
Ad sets missing learning phase protection: {list}
Total gaps: {count}

Prioritized Gap List:
1. [P1] Campaign "VIK_CONV_CRT_COLD_2026-03-31" has no CPA kill switch
2. [P1] Ad set "VIK_CONV_CRT_COLD_BROAD_50D" has no pacing guard
3. [P2] 3 ad sets have no creative fatigue alert
```

**Checkpoint: Present inventory, execution history, and gap analysis. Confirm which gaps to address before generating rule proposals.**

### Step 5: Propose New Rules

For each identified gap, use the conceptual patterns and safe-construction workflow in
`references/rule_templates.md`. Do not invent JSON specs. Reuse a working rule shape from the same
account or require Graph Explorer/Ads Manager validation.

Present each proposed rule as a DRAFT:

```
PROPOSED RULE (Plan -- Pending Approval)
==========================================
Name: {descriptive name}
Type: Kill Switch / Pacing Guard / Fatigue Alert / Learning Alert / Anomaly Alert / Scale Trigger
Entity: CAMPAIGN / ADSET / AD
Applied To: {specific campaigns/ad sets, or "All active ad sets"}
Schedule: DAILY (or SEMI_HOURLY for urgent rules)

Trigger Condition:
  Metric: {metric_name}
  Operator: {GREATER_THAN / LESS_THAN}
  Value: {threshold}
  Time Range: {LAST_7_DAYS / LAST_3_DAYS / YESTERDAY / TODAY}
  Attribution Window: {7D_CLICK_1D_VIEW or per account config}

Action:
  Type: {PAUSE / SEND_NOTIFICATION / ADJUST_BUDGET}
  Parameters: {e.g., notification to {email/slack}, or budget adjustment percentage}

Notification:
  Message: {what the notification will say}
  Recipient: {account admin email from account-conventions}

Rationale:
  {Why this rule is needed, what it protects against}

Risk:
  {Any unintended consequences to be aware of}
```

Group proposed rules by priority and present all together before asking for approval:

```
Proposed Rules Summary
=======================
P1 Kill Switches: {count} rules
P1 Pacing Guards: {count} rules
P2 Fatigue Alerts: {count} rules
P2 Learning Alerts: {count} rules
P2 Anomaly Alerts: {count} rules
P3 Scale Triggers: {count} rules

Total proposed: {count}

[Full rule specs follow below...]
```

**Checkpoint: Present all proposed rules. User approves, modifies, or rejects each rule before creation.**

Approval options:
- "Approve all" -- proceed with creating all proposed rules
- "Approve P1 only" -- create only kill switches and pacing guards
- "Approve rule 1, 3, 4" -- selective approval by number
- Individual modifications before approval

### Step 6: Create Approved Rules

For each approved rule, execute:

```
MCP tool: `meta_ads_adrule_create`
Parameters:
  ad_account_id: {numeric_ad_account_id}
  name: {rule_name}
  evaluation_spec: "{conditions as a JSON string}"
  execution_spec: "{action as a JSON string}"
  schedule_spec: "{schedule as a JSON string}"
  status: DISABLED
```

After each creation, capture the `rule_id`, list/read the stored rule back, and compare it with the
approved draft. Ask for separate approval before setting `status: ENABLED`.

If creation fails:
- Report the error with full API response
- Note what is NOT possible via automated rules (see Limitations section below)
- Suggest manual workaround if applicable

### Step 7: Update Existing Rules (If Needed)

If the audit identified rules that need modification (wrong threshold, wrong scope, outdated):

```
MCP tool: `meta_ads_adrule_update`
Parameters:
  rule_id: {existing_rule_id}
  name: {updated name, if changing}
  evaluation_spec: "{updated conditions as a JSON string}"
  execution_spec: "{updated action as a JSON string}"
  schedule_spec: "{updated schedule as a JSON string}"
  status: {ENABLED / DISABLED}
```

Present all rule updates as plans first, same as new rule proposals. Reiterate that the update is
immediate after approval.

### Step 8: Output Rules Inventory

After all creation and updates are complete, produce a final rules inventory:

```
Rules Inventory (Post-Audit)
==============================
Account: {name}
Date: {today}

Total rules active: {count}
Rules created this session: {count}
Rules updated this session: {count}
Rules disabled (flagged issues): {count}

Rules by Category:
| Category | Count | Coverage |
|----------|-------|----------|
| Kill Switches | {n} | {X of Y campaigns covered} |
| Pacing Guards | {n} | {X of Y campaigns covered} |
| Fatigue Alerts | {n} | {X of Y ad sets covered} |
| Learning Alerts | {n} | {X of Y ad sets covered} |
| Anomaly Alerts | {n} | {X of Y campaigns covered} |
| Scale Triggers | {n} | {X of Y campaigns covered} |

Active Rules Detail:
| Name | Entity | Trigger | Action | Status | Last Modified |
|------|--------|---------|--------|--------|---------------|
| {name} | ADSET | CPA > $X | PAUSE | ENABLED | {date} |

Remaining Gaps (not addressed this session):
| Gap | Reason Not Addressed |
|-----|---------------------|
| {gap} | {reason} |

Recommended Review: Check rule execution history in 7 days via [[meta-ads-manage-automated-rules]]
```

---

## Automated Rules Capabilities and Limitations

### What CAN Be Done via Automated Rules

Rules can act on and react to:

**Metrics available as trigger conditions:**
- Spend (daily, total)
- Impressions, reach, frequency
- Clicks, CTR (link click-through rate)
- CPM, CPC
- Conversions (purchase, lead, custom events)
- CPA (cost per conversion)
- ROAS (return on ad spend)
- Video views, ThruPlay rate, video play percentage
- Landing page views

**Actions available:**
- PAUSE entity (campaign, ad set, ad)
- UNPAUSE entity (re-enable)
- SEND_NOTIFICATION (email to account admins)
- ADJUST_BUDGET (increase or decrease daily budget by percentage or fixed amount)

**Scope of application:**
- Campaign level, ad set level, ad level, or account level
- Apply to all entities, a specific campaign, or hand-selected entities

### What CANNOT Be Done via Automated Rules

Be explicit with users about these limitations:

| Limitation | Workaround |
|-----------|------------|
| Cannot use incrementality metrics (iROAS, holdout lift) as triggers | Set rules on standard ROAS; check incrementality manually |
| Cannot trigger on EMQ (Estimated Match Quality) score | Monitor EMQ manually in Events Manager |
| Cannot pause a campaign and launch an alternative in one action | Two separate rules: one to pause, one (timed) to unpause |
| Cannot send Slack/webhook notifications | Only email notifications to account admin addresses |
| Cannot create, modify, or delete ads (only pause/unpause) | Use launch-campaign skill for new ads |
| Cannot target rules to audiences by name | Target by campaign/ad set ID only |
| Cannot create rules conditional on A/B test variants | Monitor experiments manually |
| Cannot react to ad delivery issues (low quality score, policy flags) | Monitor in Ads Manager; set up manual review process |
| Cannot trigger on audience saturation | Use creative fatigue frequency as a proxy |
| Cannot use custom attribution windows per rule | Rules use account default attribution window |
| Cannot evaluate across multiple time windows in one rule | Create separate rules per time window |

---

## Rule Thresholds by Account Maturity

Calibrate thresholds to the account's maturity level (from [[meta-ads-account-maturity-methodology]]):

| Rule | Nascent (<$5K/mo) | Developing ($5-20K/mo) | Established ($20-100K/mo) | Advanced (>$100K/mo) |
|------|------------------|----------------------|--------------------------|---------------------|
| CPA kill switch | 3x target CPA | 2.5x target CPA | 2x target CPA | 1.8x target CPA |
| Frequency (prospecting) | 4.0 | 3.5 | 3.0 | 2.5 |
| Frequency (retargeting) | 10.0 | 8.0 | 6.0 | 5.0 |
| Budget scale trigger | 25% below target | 20% below target | 20% below target | 15% below target |
| Anomaly alert threshold | ±50% | ±40% | ±30% | ±25% |

Lower maturity accounts need looser thresholds because: less conversion volume means more variance, and overly sensitive rules will pause campaigns before they exit the learning phase.

---

## Reference Files

- `references/rule_templates.md` -- Conceptual rule patterns, allowed top-level keys, and the required verification workflow
