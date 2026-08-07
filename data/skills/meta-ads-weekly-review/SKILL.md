---
name: meta-ads-weekly-review
description: Orchestrates the other Meta Ads skills into a structured weekly review workflow. Determines which skills to run for which accounts based on campaign types, maturity level, and cadence (weekly/monthly/quarterly). Includes 4 mandatory human checkpoints for recommendation review before output. Use when asked to run a weekly review, a Meta Ads review or audit, an account review, or a weekly ads check. Do NOT use for a single-area deep dive, which is the specific audit or analysis skill, or for a one-off dashboard, which is [[meta-ads-performance-analysis]].
metadata:
  icon: "https://cdn.renai.build/skill-icons/meta.png"
---

# Meta Ads Weekly Review (Orchestration)

## How to Call Meta Ads Tools

Call the mounted `meta_ads_*` MCP tools directly. Do not write Python wrappers.

The routed skills own their field selection and tool calls. For entity reads, they must verify
fields with `meta_ads_get_field_context` before calling `meta_ads_get_ad_entities`; use numeric
`ad_account_id` values without the `act_` prefix. Async reporting is a fallback only after a real
`meta_ads_get_ad_entities` failure in the same conversation.

There is no draft layer. Creation tools produce PAUSED campaign, ad-set, and ad entities. Human
review happens before an explicit `meta_ads_activate_entity` call. Other mutations take effect
when their MCP tool succeeds, so obtain approval at the mandatory recommendation checkpoint before
delegating an approved write.

## Purpose

This is the master orchestration skill for the Meta Ads Toolkit. It coordinates all action skills into a structured weekly review workflow, replacing the manual process of logging into Ads Manager, pulling data, eyeballing metrics, and reacting to whatever looks wrong. Instead, it runs a systematic diagnostic across every dimension of account health -- performance, creative, bidding, audiences, structure, budgets, measurement, compliance -- and produces a unified report with prioritized recommendations.

The orchestrator determines which skills to run for which accounts based on campaign types, maturity level, and review cadence. It includes 4 mandatory human checkpoints to ensure recommendations are reviewed before being finalized. This is not an autopilot; it is a co-pilot.

## When to Use

- **Weekly:** Every Monday or Tuesday as the standard review cadence
- **Monthly:** First run of the month includes deeper audits (audiences, structure, measurement, budgets)
- **Quarterly:** First run of the quarter adds compliance audit and maturity reassessment
- **Ad-hoc:** When something feels off and you want a full diagnostic
- **Onboarding:** First run for a new account (runs all skills regardless of cadence)

## Dependencies

This skill orchestrates all other action skills. It does not perform analysis itself -- it routes, sequences, and synthesizes.

| Skill Category | Skills |
|---------------|--------|
| **Always loaded** | [[meta-ads-account-conventions]], [[meta-ads-account-maturity-methodology]] |
| **Action skills (weekly)** | [[meta-ads-performance-analysis]], [[meta-ads-analyze-creative]] (with execution), [[meta-ads-performance-analysis]] follow-up |
| **Action skills (bi-weekly)** | [[meta-ads-audit-audiences]] (with execution), [[meta-ads-audit-bidding]] (with execution), [[meta-ads-manage-automated-rules]] |
| **Action skills (monthly)** | [[meta-ads-optimize-budgets]] (with execution), [[meta-ads-audit-measurement]] (with execution), [[meta-ads-audit-structure]] |
| **Action skills (quarterly)** | [[meta-ads-audit-compliance]], [[meta-ads-analyze-advantage-plus]], [[meta-ads-analyze-catalog]] (with execution) |
| **Action skills (on-demand)** | [[meta-ads-launch-campaign]], [[meta-ads-investigate-campaign]] (triggered by flags), [[meta-ads-generate-creative-brief]] |

---

## Step 0: Load Configuration and Determine Scope

### Read Account Config

Read [[meta-ads-account-conventions]] and extract the full account roster:

For each account:
- `account_name`, `ad_account_id`
- `status` (active, paused, onboarding)
- `maturity_level` (nascent, developing, established, advanced)
- `monthly_spend` (for context and prioritization)
- `capabilities` (has_advantage_plus, has_catalog, campaign_types_active)
- `kpi_config` (targets, thresholds)
- `creative_config` (testing framework, volume targets)
- `reporting` (period, comparison, output_path, output_naming)

### Present Account Roster

```
Meta Ads Weekly Review -- Pre-Flight
=====================================
Date: {today}
Review type: {Weekly / Monthly / Quarterly} (auto-detected from date)

Account Roster:
| # | Account | Status | Maturity | Monthly Spend | Last Reviewed |
|---|---------|--------|----------|---------------|---------------|
| 1 | {name}  | Active | Established | $30K | {date} |
| 2 | {name}  | Active | Developing | $8K | {date} |

Reporting Period: {calculated from config}
Comparison: {comparison method from config}
```

### Calculate Review Cadence

Determine what type of review this is:

```python
# Pseudocode for cadence detection
today = current_date()
is_first_run_of_month = today.day <= 7 or last_review_date.month != today.month
is_first_run_of_quarter = is_first_run_of_month and today.month in [1, 4, 7, 10]
is_onboarding = account.last_review_date is None

if is_onboarding:
    cadence = "onboarding"  # Run everything
elif is_first_run_of_quarter:
    cadence = "quarterly"
elif is_first_run_of_month:
    cadence = "monthly"
else:
    cadence = "weekly"
```

### Ask About Special Circumstances

Before proceeding, ask:
- Were any campaigns paused, launched, or significantly changed since last review?
- Any upcoming events (promotions, seasonal peaks, product launches)?
- Budget changes (increases, decreases, new budget allocated)?
- Known issues or areas of concern?

**Checkpoint 1: Confirm accounts, date range, cadence, and special circumstances before proceeding.**

---

## Step 1: Authentication Check

### Verify MCP Connection

Test the Meta Ads integration by calling `meta_ads_get_ad_accounts`. Follow `next_cursor` when the
configured roster is larger than one response page.

- Confirm the MCP server is connected and responding
- Verify each configured numeric account ID is present, enabled, and `is_queryable`
- If connection fails, ask the user to connect or repair the Meta Ads MCP integration in Ren
- If any account returns an error, flag it and exclude from the review (do not block other accounts)

### Access Verification

For each account, confirm:
- Account ID is valid and accessible
- User has sufficient permissions (at minimum: read access to campaigns, ad sets, ads, insights)
- API rate limits are not already exhausted

**Do NOT proceed past this step until authentication is confirmed for at least one account.** If all accounts fail auth, stop and troubleshoot.

---

## Step 2: Skill Routing

Based on each account's capabilities, cadence, and maturity, determine which skills to run.

### Routing Matrix

| Condition | Skill | Cadence | Notes |
|-----------|-------|---------|-------|
| All active accounts | [[meta-ads-performance-analysis]] | Every run | Always first. Establishes baseline and generates flags. |
| All active accounts | [[meta-ads-analyze-creative]] | Weekly (with execution) | Creative fatigue, scorecard, pause/refresh actions. |
| All active accounts | [[meta-ads-audit-bidding]] | Bi-weekly (with execution) | Bid strategy health check and bid updates. |
| All active accounts | [[meta-ads-audit-audiences]] | Bi-weekly (with execution) | Audience overlap, saturation, expansion. |
| All active accounts | [[meta-ads-manage-automated-rules]] | Bi-weekly | Rule coverage audit, gap fill, execution history check. |
| All active accounts | [[meta-ads-optimize-budgets]] | Monthly (with execution) | Budget reallocation and scaling. |
| All active accounts | [[meta-ads-audit-measurement]] | Monthly (with execution) | Pixel, CAPI, attribution settings. |
| All active accounts | [[meta-ads-audit-structure]] | Monthly | Campaign architecture and consolidation. |
| All active accounts | [[meta-ads-audit-compliance]] | Quarterly | Policy, ad disapprovals, account health. |
| has_advantage_plus = true | [[meta-ads-analyze-advantage-plus]] | Quarterly | ASC-specific analysis. Skip if no ASC campaigns. |
| has_catalog = true | [[meta-ads-analyze-catalog]] | Quarterly (with execution) | Catalog/DPA analysis and feed quality fixes. |
| On-demand | [[meta-ads-launch-campaign]] | As needed | New campaign creation from brief. Triggered by user request. |
| Flagged campaigns | [[meta-ads-investigate-campaign]] | As needed | Triggered by red flags from performance-analysis. |
| All active accounts | [[meta-ads-generate-creative-brief]] | Per config | Weekly or monthly depending on creative_config. |
| All active accounts | Experiment workflow | On-demand | Not available in this skill catalog; say so rather than routing to a nonexistent skill. |

### Onboarding Override

For accounts with `cadence = "onboarding"`, run ALL skills regardless of cadence rules. This establishes the baseline for future reviews.

### Present Routing Matrix

```
Skill Routing for This Review
===============================
Cadence: {Weekly / Monthly / Quarterly / Onboarding}

| Account | performance | creative | bidding | A+ | catalog | audiences | structure | measurement | budgets | compliance | brief | investigate |
|---------|------------|---------|---------|----|---------|-----------|-----------|----|---------|------------|-------|-------------|
| {name}  | Yes | Yes | Yes | Yes | No | {Monthly?} | {Monthly?} | {Monthly?} | {Monthly?} | {Quarterly?} | {Config} | {If flagged} |

Total skill invocations: {count}
Estimated duration: {minutes} (based on account count and skill count)
```

**Checkpoint 2: Confirm routing matrix. User can add/remove skills for specific accounts.**

---

## Step 3: Execute Per Account

Process each account sequentially. Within each account, skills are executed in a specific order due to dependencies.

### Phase 3a: Performance Baseline (Sequential, First)

Run [[meta-ads-performance-analysis]] for the account.

This must complete first because:
- It establishes the performance context all other skills reference
- It generates the flag list that triggers [[meta-ads-investigate-campaign]]
- It identifies campaigns that need deeper analysis

**Capture from performance-analysis:**
- Account health status (healthy/warning/critical)
- Active flags list (with severity and recommended skill)
- Campaign-level performance summary
- 4-week trend data

### Phase 3b: Independent Skills (Parallel Where Possible)

These skills can run independently of each other (but all depend on Phase 3a):

- [[meta-ads-analyze-creative]] -- creative scorecard, fatigue detection
- [[meta-ads-audit-bidding]] -- bid strategy assessment, strategy recommendations
- [[meta-ads-analyze-advantage-plus]] (if applicable) -- ASC performance, manual vs ASC comparison
- [[meta-ads-analyze-catalog]] (if applicable) -- catalog health, feed quality, DPA performance

**Capture from each:**
- Key findings list
- Flagged items
- Recommendations with priority

### Phase 3c: Dependent Skills (Sequential, After 3b)

These skills depend on findings from Phase 3b:

- [[meta-ads-optimize-budgets]] -- needs bidding context from audit-bidding, pacing from performance-analysis
- [[meta-ads-investigate-campaign]] -- triggered for any campaign with red flags from 3a or 3b

**Capture from each:**
- Budget reallocation table (from optimize-budgets)
- Root cause analysis (from investigate-campaign)

### Phase 3d: Monthly/Quarterly Skills (If Cadence Applies)

Only run if the cadence trigger is met:

- [[meta-ads-audit-audiences]] (monthly) -- overlap analysis, saturation, expansion
- [[meta-ads-audit-structure]] (monthly) -- campaign architecture, consolidation opportunities
- [[meta-ads-audit-measurement]] (monthly) -- pixel health, CAPI, attribution
- [[meta-ads-audit-compliance]] (quarterly) -- policy compliance, ad disapprovals

### Phase 3e: Creative Brief Generation (If Configured)

Run [[meta-ads-generate-creative-brief]] based on:
- Fatigue alerts from [[meta-ads-analyze-creative]]
- Format and concept gaps identified
- Config setting for creative brief cadence

### Phase 3f: Collect All Findings

Aggregate all findings into a unified structure:

```
Account: {name}
Health Status: {Healthy / Warning / Critical}
Skills Run: {list}
Total Flags: {count} (Red: {count}, Yellow: {count})

Findings by Skill:
- performance-analysis: {summary}
- analyze-creative: {summary}
- audit-bidding: {summary}
- analyze-advantage-plus: {summary or "N/A"}
- analyze-catalog: {summary or "N/A"}
- optimize-budgets: {summary or "Not run this cadence"}
- investigate-campaign: {summary or "No campaigns investigated"}
- audit-audiences: {summary or "Not run this cadence"}
- audit-structure: {summary or "Not run this cadence"}
- audit-measurement: {summary or "Not run this cadence"}
- audit-compliance: {summary or "Not run this cadence"}
- generate-creative-brief: {summary or "Not run this cadence"}

Top Recommendations (ranked by impact):
1. {recommendation}
2. {recommendation}
3. {recommendation}
```

---

## Step 4: Recommendations Checkpoint (Mandatory)

**This is Checkpoint 3. It is NEVER skipped, even if the user says "skip checkpoints."**

Recommendations require human sign-off because they involve budget changes, campaign modifications, and strategic direction. Autonomous execution of ad account changes creates real financial risk.

### Consolidated Recommendations View

```
Meta Ads Weekly Review -- Recommendations
===========================================
Date: {today}
Period: {date_range}

Account Health Summary:
| Account | Status | Spend | CPA | ROAS | WoW CPA | Flags |
|---------|--------|-------|-----|------|---------|-------|
| {name}  | Warning | $X,XXX | $XX | X.Xx | +15% | 3 (1 red, 2 yellow) |

Top 3 Recommendations per Account:

### {Account Name 1}
1. **[HIGH] Reallocate $200/day from {Campaign A} to {Campaign B}**
   Source: [[meta-ads-optimize-budgets]]
   Rationale: Campaign A at diminishing returns (marginal CPA $95), Campaign B constrained-efficient (CPA $42)
   Projected impact: +4 conversions/day, blended CPA improvement from $52 to $47

2. **[HIGH] Pause 3 fatigued creatives, launch 5 replacements**
   Source: [[meta-ads-analyze-creative]]
   Rationale: 3 ads in critical fatigue (CTR down 25%+, frequency >3.0)
   Action: Pause VID_TESTIMON_V2, STAT_DEMO_V4, UGC_PAIN_V1. Briefs generated.

3. **[MEDIUM] Switch Campaign C from LCAP to CBO auto-bid**
   Source: [[meta-ads-audit-bidding]]
   Rationale: Cost cap too tight, campaign underdelivering at 45% pacing
   Risk: CPA may spike 20% short-term during learning. Monitor 72h.

Cross-Account Patterns:
- {pattern, e.g., "CPM rising across all accounts -- likely seasonal auction pressure"}
- {pattern}

Critical Flags Requiring Immediate Action:
- {flag description and recommended response}
```

**Wait for user to confirm, modify, or reject recommendations before generating output.**

If the user modifies recommendations, update the output accordingly.

---

## Step 5: Output Generation

### Per-Account Reports

For each account, write a comprehensive markdown report.

**Persistence path:** `{reporting.output_path}{account_name}-weekly-review-{date}.md` in the project
FileStore. If FileStore is unavailable, use MemoryStore when attached; otherwise return the report
in chat.

```markdown
# Meta Ads Weekly Review: {account_name}
Generated: {date} | Period: {date_range}
Review Type: {Weekly / Monthly / Quarterly}
Account Maturity: {maturity_level}

## Executive Summary

### Account Health: {Healthy / Warning / Critical}

| Metric | Current | Prior | Delta | Target | Flag |
|--------|---------|-------|-------|--------|------|
| Spend | $X,XXX | $X,XXX | +XX% | $XX,XXX/mo | -- |
| Conversions | XXX | XXX | +XX% | -- | Green |
| CPA | $XX.XX | $XX.XX | +XX% | $XX.XX | Yellow |
| ROAS | X.Xx | X.Xx | -XX% | X.Xx | Yellow |

### Top 3 Action Items
1. {Action} -- {Source skill} -- {Expected impact}
2. {Action} -- {Source skill} -- {Expected impact}
3. {Action} -- {Source skill} -- {Expected impact}

## Performance Dashboard
{Full output from [[meta-ads-performance-analysis]]}

## Creative Analysis
{Summary from [[meta-ads-analyze-creative]]}
- Star performers: {count}
- Fatigued: {count}
- Kill candidates: {count}
- Testing velocity: {actual} vs {target}/week

## Bidding Assessment
{Summary from [[meta-ads-audit-bidding]]}
- Campaigns with optimal bid strategy: {count}/{total}
- Recommended changes: {list}

## Advantage+ Analysis
{Summary from [[meta-ads-analyze-advantage-plus]], or "N/A -- no ASC campaigns"}

## Catalog Analysis
{Summary from [[meta-ads-analyze-catalog]], or "N/A -- no catalog campaigns"}

## Budget Optimization
{Summary from [[meta-ads-optimize-budgets]], if run}
- Reallocation table: {included if generated}
- Scaling schedule: {included if generated}

## Campaign Investigations
{Summary from [[meta-ads-investigate-campaign]] for each investigated campaign}

## Audience Audit
{Summary from [[meta-ads-audit-audiences]], if run this cadence, or "Next scheduled: {date}"}

## Structure Audit
{Summary from [[meta-ads-audit-structure]], if run this cadence, or "Next scheduled: {date}"}

## Measurement Audit
{Summary from [[meta-ads-audit-measurement]], if run this cadence, or "Next scheduled: {date}"}

## Compliance Audit
{Summary from [[meta-ads-audit-compliance]], if run this cadence, or "Next scheduled: {date}"}

## Creative Briefs
{Summary from [[meta-ads-generate-creative-brief]], if run}
- Concepts generated: {count}
- Briefs ready for production: {count}

## Active Flags

| # | Flag | Scope | Value | Threshold | Severity | Action | Owner |
|---|------|-------|-------|-----------|----------|--------|-------|
| 1 | CPA_CRIT | {Campaign} | $45 | $30 | Red | Investigate | {owner} |
| 2 | CTR_DECLINE | {Campaign} | 3 weeks | 3 weeks | Yellow | Creative refresh | {owner} |

## Recommendations (Approved)

| # | Priority | Recommendation | Source | Projected Impact | Timeline | Status |
|---|----------|---------------|--------|-----------------|----------|--------|
| 1 | High | {recommendation} | /skill | {impact} | This week | Approved |
| 2 | High | {recommendation} | /skill | {impact} | This week | Approved |
| 3 | Medium | {recommendation} | /skill | {impact} | Next week | Approved |

## Follow-Up Items

| Item | Owner | Deadline | Status |
|------|-------|----------|--------|
| {follow-up} | {owner} | {date} | Pending |

## Notes
- {Any caveats, data gaps, or context}
- Next review: {date}
- Next monthly review: {date}
- Next quarterly review: {date}
```

### Cross-Account Summary (if multiple accounts)

Only generate if `include_cross_account_summary: true` in config or if reviewing 2+ accounts.

```markdown
# Meta Ads Cross-Account Summary
Generated: {date} | Period: {date_range}

## Portfolio Overview

| Account | Status | Spend | Conv | CPA | ROAS | WoW CPA | Top Flag |
|---------|--------|-------|------|-----|------|---------|----------|
| {name} | Warning | $X,XXX | XX | $XX | X.Xx | +15% | CPA_CRIT |
| {name} | Healthy | $X,XXX | XX | $XX | X.Xx | -5% | None |

## Portfolio Totals

| Metric | Total | WoW Change |
|--------|-------|------------|
| Spend | $XX,XXX | +XX% |
| Conversions | XXX | +XX% |
| Blended CPA | $XX.XX | +XX% |
| Weighted ROAS | X.Xx | +XX% |

## Cross-Account Patterns
1. {pattern and implication}
2. {pattern and implication}

## Portfolio Recommendations
1. {recommendation affecting multiple accounts}

## Account-Level Summaries
{One-paragraph summary per account with link to full report}
```

---

## Step 6: Memory and Follow-Up

### Record Review Metadata

Ask the user if they want to save review findings for next week's comparison:

- Account health status (for trend tracking across reviews)
- Key metrics snapshot (for WoW review-over-review comparison)
- Open flags (for carry-forward tracking)
- Recommendations status (approved/rejected/deferred)

### Compile Follow-Up Items

From all skills, extract items that require action before next review:

| Item | Source Skill | Owner | Deadline | Priority |
|------|-------------|-------|----------|----------|
| Reallocate $200/day from Campaign A to B | [[meta-ads-optimize-budgets]] | {owner} | By {date} | High |
| Launch 5 replacement creatives | [[meta-ads-generate-creative-brief]] | {owner} | By {date} | High |
| Switch Campaign C to auto-bid | [[meta-ads-audit-bidding]] | {owner} | By {date} | Medium |
| Set up CAPI for website events | [[meta-ads-audit-measurement]] | {owner} | By {date} | Medium |

### Prompt Config Updates

Based on review findings, check if any config values need updating:

- **Maturity level:** Has the account graduated (e.g., from Developing to Established)?
- **KPI targets:** Are targets still realistic based on 4-week trends?
- **Flag thresholds:** Are warning/critical thresholds generating too many or too few flags?
- **Creative config:** Does the testing framework or volume target need adjustment?
- **Capabilities:** Has ASC been launched or a catalog been added since last config update?

### Note Campaigns for Next Review

Flag campaigns that should get extra attention next week:
- Campaigns that just received budget changes (monitor stability)
- Campaigns with new creatives launching (track initial performance)
- Campaigns that were flagged but not investigated this week
- Any experiments approaching their kill date

**Checkpoint 4: Confirm files written, memory items saved, follow-up list complete, and config updates (if any).**

---

## Checkpoint Protocol Summary

| # | When | What to Confirm | Can User Skip? |
|---|------|-----------------|----------------|
| 1 | Pre-flight (Step 0-1) | Accounts, date range, auth status, special circumstances | Yes (proceed with defaults) |
| 2 | Post-routing (Step 2) | Skill routing matrix per account, cadence detection | Yes (proceed with auto-routing) |
| 3 | Post-analysis (Step 4) | Top 3 recommendations per account, cross-account patterns, critical flags | **No. Never skip.** |
| 4 | Post-output (Step 5-6) | Files written, memory items, follow-up list, config updates | Yes (proceed with defaults) |

If the user says "skip checkpoints" or "run automatically," Checkpoints 1, 2, and 4 can be streamlined (present briefly, proceed unless user objects). Checkpoint 3 must always pause for explicit confirmation.

---

## Cadence Guide

| Cadence | Scope | Skills Run | When |
|---------|-------|-----------|------|
| **Weekly** | Performance baseline, creative fatigue + execution, pacing flags | performance-analysis, analyze-creative (with execution), investigate-campaign (if flagged), generate-creative-brief (per config) | Every run |
| **Bi-weekly** | + Audience health, bidding strategy updates, automated rule coverage | + audit-audiences (with execution), audit-bidding (with execution), manage-automated-rules | Every other week |
| **Monthly** | + Budget optimization, measurement audit, structure review | + optimize-budgets (with execution), audit-measurement (with execution), audit-structure | First run of the month |
| **Quarterly** | + Compliance audit, A+ analysis, catalog analysis, maturity reassessment | + audit-compliance, analyze-advantage-plus, analyze-catalog (with execution), maturity reassessment | First run of the quarter |
| **On-demand** | New campaigns, investigations, creative briefs, rule setup | launch-campaign, investigate-campaign, generate-creative-brief, manage-automated-rules | Triggered by user request; experiment management is currently unsupported |
| **Onboarding** | All skills, full baseline | All skills regardless of cadence | First ever run for an account |

---

## Error Handling

| Issue | Detection | Resolution |
|-------|----------|------------|
| MCP authentication failure | meta_ads_get_ad_accounts returns error | Stop at Step 1. Instruct user to verify MCP connection and API credentials. Do not attempt to run any skills. |
| Partial account access | Some accounts accessible, others not | Proceed with accessible accounts. Flag inaccessible ones in the report. Include troubleshooting notes. |
| Skill execution failure | An action skill returns an error mid-run | Log the error, skip that skill for the affected account, continue with remaining skills. Note the gap in the final report. |
| Excessive flags (>20 per account) | Flag count from performance-analysis | Prioritize flags by severity and spend impact. Present top 10, note remaining count. Likely indicates a structural or measurement issue. |
| Very large account (>50 campaigns) | Campaign count from performance-analysis | May hit API rate limits. Batch skills and add delays between calls. Focus on active, spending campaigns first. Deprioritize paused campaigns. |
| First-time run with no config | account-conventions not configured | Run the setup questionnaire from account-conventions before proceeding. Cannot run review without at minimum: ad_account_id, primary KPI, and KPI targets. |
| Conflicting recommendations | Different skills suggest opposite actions | Flag the conflict in Checkpoint 3. Example: optimize-budgets says scale Campaign A, but audit-audiences says audience is saturated. Present both perspectives and let user decide. |
| Review takes too long | Total execution exceeds 30 minutes | Batch accounts: complete one account fully before starting the next. Provide interim updates after each account. User can stop early and resume later. |
