---
name: meta-ads-launch-campaign
description: Takes a campaign brief and launches a complete Meta Ads campaign (campaign → ad set → creative → ad), enforcing naming conventions, running a pre-launch checklist, and producing a human-approved Launch Draft before any creation happens. Use when asked to launch, create, build, or set up a new Meta campaign or ad, or when handed a campaign brief.
metadata:
  icon: "https://cdn.renai.build/skill-icons/meta.png"
---

# Launch Campaign

## How to Call Meta Ads Tools

Call the mounted `meta_ads_*` MCP tools directly. Do not write a Python wrapper.

Campaign, ad-set, and ad creation tools always create PAUSED entities. Present the complete launch
plan and obtain approval before creation. After creation, preview and verify the entities, then
obtain a second explicit approval before calling `meta_ads_activate_entity` from campaign to ad set
to ad. Activation starts spending.

Use numeric `ad_account_id` values without `act_`. Budget inputs use the smallest unit of the
account currency. `meta_ads_create_campaign` requires `buying_type`. Creative creation requires a
Facebook `page_id`; discover it with `meta_ads_get_ad_account_pages`.

## Purpose

This skill takes a campaign brief and creates a complete Meta Ads campaign from scratch: campaign
→ ad set → creative → ad. It enforces [[meta-ads-account-conventions]], runs a pre-launch
checklist, and produces a structured launch plan for human review before a creation call executes.

Created entities remain PAUSED until the user separately approves activation.

## When to Use This Skill

- You have creatives ready and want to push a new test campaign live
- You are launching a Winners campaign to scale a proven concept
- You need to build an ASC (Advantage+ Shopping) campaign
- You are setting up a lead gen or awareness campaign
- You want to recreate a campaign structure for a new vertical or audience (the MCP has no
  one-call duplicate operation)

## Required Inputs

Before execution, collect:

- **Account:** Which ad account (from [[meta-ads-account-conventions]] roster)
- **Campaign type:** Creative Testing / Winners / ASC / Lead Gen / Awareness / Engagement
- **Objective:** What are we optimizing for? (conversions, leads, traffic, etc.)
- **Budget:** Daily or lifetime? Amount?
- **Bid strategy:** Lowest cost / Cost cap / Bid cap?
- **Audience:** Cold / warm / retargeting? Existing audience or build new?
- **Placements:** Advantage+ Placements or manual selection?
- **Creatives:** Asset list — images/videos, headlines, primary text, CTAs, destination URL
- **Flight dates:** Start date (and end date if lifetime budget)
- **UTM parameters:** Tracking template or UTM string for destination URL

If any input is missing, ask before proceeding to the Launch Draft.

---

## Execution Model

### Step 1: Load Account Configuration

Read [[meta-ads-account-conventions]] and extract for the target account:
- `ad_account_id` (numeric, without the `act_` prefix)
- `naming_convention` (campaign, ad set, ad level patterns)
- `pixel_id` and `custom_conversion_ids`
- `kpi_config` (primary KPI, CPA/ROAS targets, bid cap ceilings)
- `maturity_level` (affects structural guidance)
- `default_placements` and `targeting_exclusions`

Also read [[meta-ads-account-maturity-methodology]] to confirm the appropriate campaign model for
this account's maturity level.

### Step 2: Determine Campaign Type and Apply Template

Match the user's brief to one of the five campaign types. Load the corresponding template from `references/campaign_templates.md`:

| Brief Signals | Campaign Type |
|--------------|---------------|
| "test new creatives," "creative test," "new concepts" | Creative Testing (ABO) |
| "scale winners," "proven creative," "post ID," "social proof" | Winners (CBO) |
| "advantage+," "ASC," "blended prospecting + retargeting" | ASC / Advantage+ |
| "lead form," "collect leads," "lead ads" | Lead Generation |
| "brand awareness," "video views," "reach," "engagement" | Awareness / Engagement |

Apply the structural rules for that campaign type (budget type, CBO vs ABO, creative count, bid strategy defaults).

### Step 3: Collect and Validate the Brief

Gather all inputs. For each field, validate:

- Budget in cents (e.g., $50/day = 5000). Flag if budget is below $20/day per ad set for testing campaigns.
- Bid cap: must be >= 1.5x historical average CPA for the account (from account-conventions KPI config). Flag if lower.
- Audience size: for cold audiences, warn if estimated reach < 1M. For retargeting, note if audience is < 10K (learning phase risk).
- Creative count: for Creative Testing campaigns, flag if fewer than 5 ads or more than 20.
- Dynamic creative: if requested, explain that asset-feed authoring is unsupported in this path
  and switch to flat creatives or a manual Ads Manager workflow.
- Day parting: if requested, confirm lifetime budget is being used (daily budget is incompatible with day parting).
- CBO + ad set budgets: if CBO is enabled at campaign level, confirm no ad set-level budgets are set.

### Step 4: Apply Naming Convention

Generate names for each object using the naming convention from account-conventions.

Typical pattern:
```
Campaign: {ACCOUNT_PREFIX}_{OBJECTIVE}_{TYPE}_{AUDIENCE}_{DATE}
Ad Set:   {CAMPAIGN_PREFIX}_{AUDIENCE_DETAIL}_{BUDGET}_{DATE}
Ad:       {AD_SET_PREFIX}_{FORMAT}_{CONCEPT}_{VARIANT}_{DATE}
```

Example:
```
Campaign: VIK_CONV_CRT_COLD_2026-03-31
Ad Set:   VIK_CONV_CRT_COLD_BROAD_50D_2026-03-31
Ad:       VIK_CONV_CRT_COLD_BROAD_VID_DEMO_V1_2026-03-31
```

If the account has no naming convention configured in account-conventions, use this default structure and flag that a convention should be added to the config.

### Step 5: Run Pre-Launch Checklist

Before generating the Launch Draft, validate every item in `references/launch_checklist.md`.
Call `meta_ads_get_ad_account_pages` and require the user to select the owning `page_id` before
creating anything. For lead campaigns, the selected Page must report `leadgen_tos_accepted: true`.

Present checklist results as:

```
Pre-Launch Checklist
====================
[PASS] Pixel is firing on destination URL (verified via pixel helper or recent events)
[PASS] Custom conversion is active and receiving events
[PASS] Tracking template / UTM parameters set
[PASS] Cold audience estimated reach > 1M
[PASS] Exclusions set (past purchasers, current customers)
[WARN] No creative refresh since last campaign -- verify assets are new
[FAIL] Bid cap below 1.5x historical CPA -- recommend raising from $45 to $65

Checklist result: PASS WITH WARNINGS (1 warn, 1 fail)
```

If any item is FAIL, block launch and explain what needs to be resolved. WARN items are flagged but do not block. User can override a FAIL with explicit acknowledgment ("I acknowledge the bid cap is low, proceed").

### Step 6: Generate Launch Draft

Produce the full Launch Draft showing every parameter before execution:

```
LAUNCH DRAFT -- Pending Approval
=================================
Account: {account_name} ({ad_account_id})
Campaign Type: {type}
Pre-Launch Checklist: {PASS / PASS WITH WARNINGS / BLOCKED}

--- CAMPAIGN ---
Name:        {generated name}
Objective:   {OUTCOME_SALES / OUTCOME_LEADS / etc.}
Status:      PAUSED (activate manually after review)
Buying Type: AUCTION
Special Ad Category: NONE (or HOUSING / CREDIT / EMPLOYMENT if applicable)
CBO Enabled: {true/false}
Daily Budget (if CBO): ${amount} ({amount_cents} cents)

--- AD SET ---
Name:              {generated name}
Optimization Goal: {OFFSITE_CONVERSIONS / LEADS / etc.}
Billing Event:     IMPRESSIONS
Bid Strategy:      {LOWEST_COST_WITHOUT_CAP / COST_CAP / LOWEST_COST_WITH_BID_CAP}
Bid Amount:        ${amount} (if applicable)
Daily Budget:      ${amount} ({amount_cents} cents) [ABO only]
Start Time:        {ISO 8601}
End Time:          {ISO 8601 or "None -- ongoing"}
Targeting:
  - Geo: {locations}
  - Age: {min}-{max}
  - Gender: {all/male/female}
  - Interests: {list or "None -- broad"}
  - Custom Audiences: {list or "None"}
  - Exclusions: {list}
  - Audience Size Est: {range}
Placements:        {Advantage+ / Manual: Feed, Reels, Stories, etc.}
Dynamic Creative:  {true/false}
Day Parting:       {schedule or "None"}

--- CREATIVE ---
(Repeat per unique creative)
Creative Name:  {generated name}
Format:         {SINGLE_IMAGE / VIDEO / CAROUSEL / COLLECTION}
Image/Video:    {asset reference or upload required}
Headline:       {text}
Primary Text:   {text}
Description:    {text or "None"}
CTA Button:     {LEARN_MORE / SIGN_UP / etc.}
Destination URL: {url}
Tracking:       {UTM string}

--- AD ---
Name:    {generated name}
Status:  PAUSED
Creative: {creative name above}
Ad Set:  {ad set name above}

--- API CALL SEQUENCE ---
1. create_campaign       -- creates campaign object
2. create_ad_set         -- creates ad set linked to campaign
3. get_ad_account_pages  -- selects the owning Facebook Page
4. creative_upload_image -- uploads a public image URL if needed
   OR creative_upload_video -- uploads a public video URL, then wait until processing is ready
5. create_creative       -- assembles a flat image, video, carousel, or catalog creative
6. create_ad             -- links creative to ad set
7. [Optional] set_adset_schedule -- applies day parting if configured
8. get_ad_preview        -- shows the created ad before activation

IMPORTANT: Everything is created PAUSED. Activation requires a separate confirmation after
verification and preview.
```

**Checkpoint: Present Launch Draft. Do NOT proceed until user explicitly approves.**

Ask: "Does everything look correct? Type APPROVE to proceed with creation, or tell me what to change."

### Step 7: Execute in Order

On approval, call the tools directly in this order and capture the returned IDs.

1. Call `meta_ads_create_campaign`:

```
ad_account_id: {numeric_ad_account_id}
campaign_name: {campaign_name}
objective: {ODAX_OUTCOME}
buying_type: "AUCTION"
special_ad_categories: "[]"
campaign_daily_budget: {minor_units}  # CBO only; omit for ABO
campaign_bid_strategy: {strategy}     # CBO only
```

2. Call `meta_ads_create_ad_set` using the returned `campaign_id`. For CBO, omit ad-set budget and
bid fields. For ABO, set `daily_budget` or `lifetime_budget` and the ad-set bid strategy. Use only
an optimization goal returned as valid by campaign creation.

3. Reuse the `page_id` selected during pre-launch validation.

4. Prepare media:
   - For an existing image hash or video ID, reuse it.
   - For a new image, call `meta_ads_creative_upload_image` with a direct, publicly accessible
     `image_url`.
   - For a new video, call `meta_ads_creative_upload_video` with a direct `video_url`, then poll
     `meta_ads_get_ad_videos` by `video_id` until `video_status` is `ready`.
   - Local files, authenticated share links, and raw bytes cannot be uploaded. Ask the user for a
     public direct URL.

5. Call `meta_ads_create_creative` with `ad_account_id`, `page_id`, `name`, and flat format fields:
   - image: `image_hash` or `image_url`, `link_url`, `message`, `headline`, `description`, CTA;
   - video: `video_id`, thumbnail `image_hash` or `image_url`, plus the text fields;
   - static carousel: `cards`;
   - catalog carousel: `product_set_id` and `link_url`.

Append UTM parameters to `link_url`; the tool has no `url_tags` parameter. Do not pass
`asset_feed_spec`, `object_story_spec`, or `degrees_of_freedom_spec`. Dynamic Creative and
Advantage+ creative asset-feed authoring are not supported by this path.

6. Call `meta_ads_create_ad`:

```
ad_account_id: {numeric_ad_account_id}
ad_set_id: {ad_set_id}
ad_name: {ad_name}
creative: '{"creative_id":"{creative_id}"}'
```

7. If day parting is requested, call `meta_ads_set_adset_schedule`:

```
adset_id: {ad_set_id}
adset_schedule: '{JSON schedule array}'
```

All three entities remain PAUSED. If any step fails, stop before the next call.

If any step fails:
- Stop immediately. Do not continue to next step.
- Report the error with the full API response.
- Do not attempt to clean up partially created objects unless the user asks.
- Note every successfully created ID. Leave partial objects PAUSED by default. If the user explicitly
  asks to delete a partial object, present a separate `meta_ads_update_entity` call with
  `fields: '{"status":"DELETED"}'` for approval; deletion is destructive.

### Step 8: Verify Launch

After all steps complete:

```
1. Call `meta_ads_get_field_context` for the verification fields.
2. Call `meta_ads_get_ad_entities` once per level, filtering the relevant `id`.
3. Call `meta_ads_get_creatives` with `creative_ids: [{creative_id}]`.
4. Call `meta_ads_get_ad_preview` with `ad_id` and include its `preview_url` as a clickable link.
   If a fresh ad cannot be previewed, retry with `creative_id`.
```

Confirm:
- Campaign exists with correct objective and status
- Ad set is linked to correct campaign with correct targeting
- Creative is correctly assembled
- Ad is linked to correct ad set and creative

If any verification fails (object not found, wrong parameters), flag immediately.

### Step 9: Activate Only After a Second Approval

Show the verified IDs, PAUSED statuses, and preview links. Ask whether the user wants to activate
now. If explicitly approved, call `meta_ads_activate_entity` in this order:

1. `ad_account_id: {numeric_ad_account_id}`, `entity_id: {campaign_id}`, `entity_type: "campaign"`
2. `ad_account_id: {numeric_ad_account_id}`, `entity_id: {ad_set_id}`, `entity_type: "ad_set"`
3. `ad_account_id: {numeric_ad_account_id}`, `entity_id: {ad_id}`, `entity_type: "ad"`

Stop if any activation fails. Activating a parent does not activate its children, and activating a
child under a paused parent does not make it deliver.

### Step 10: Launch Report

Output a final launch report:

```
LAUNCH REPORT
==============
Account: {name}
Date: {today}

Objects Created:
| Object | Name | ID | Status |
|--------|------|----|--------|
| Campaign | {name} | {id} | PAUSED |
| Ad Set | {name} | {id} | PAUSED |
| Creative | {name} | {id} | Active |
| Ad | {name} | {id} | PAUSED |

Ads Manager Links:
- Campaign: https://www.facebook.com/adsmanager/manage/campaigns?act={account_id_digits}&selected_campaign_ids={campaign_id}
- Ad Set: https://www.facebook.com/adsmanager/manage/adsets?act={account_id_digits}&selected_adset_ids={ad_set_id}

Pre-Launch Checklist: {status}
Naming Convention Applied: {yes/no}

Next Steps:
1. Review in Ads Manager using the links above
2. Open each `preview_url` returned by `meta_ads_get_ad_preview`
3. When ready, explicitly approve activation of campaign, ad set, and ad
4. Set a 72-hour check-in reminder to review initial delivery and CPM
5. If learning phase: expect 1-7 days before performance stabilizes (target 50 conversions/week per ad set)
```

---

## Campaign Type Quick Reference

See `references/campaign_templates.md` for full specs per type.

| Type | Budget | CBO | Bid Strategy | Creative Count | Key Constraint |
|------|--------|-----|-------------|----------------|----------------|
| Creative Testing | ABO | No | Cost Cap | 5-10 ads/concept, 15-20 total | 1 ad set per concept |
| Winners | CBO | Yes | Lowest Cost | 3-6 proven ads | Post-ID/social-proof reuse is manual |
| ASC | Lifetime or Daily | N/A (ASC auto-manages) | Highest Value | 10+ assets recommended | Catalog required for DPA blend |
| Lead Gen | ABO or CBO | Either | Cost Cap or Lowest | 3-5 variations | Lead form must be pre-approved |
| Awareness | Lifetime | No | CPM / Lowest Cost | 3-5 video assets | Reels/video placements preferred |

---

## Technical Notes

- Monetary values are always in **cents**. $50 = 5000. $1,000 = 100000.
- Account IDs are numeric and omit the `act_` prefix.
- Dynamic Creative asset-feed authoring is not supported by `meta_ads_create_creative`. Use flat
  image/video fields, static `cards`, or a catalog `product_set_id`.
- Day parting requires lifetime budget on the ad set. Daily budget campaigns cannot use day parting.
- CBO (campaign budget optimization): when enabled at campaign level, never set `daily_budget` on individual ad sets.
- Campaign, ad set, and ad are created PAUSED. After review, call
  `meta_ads_activate_entity` from top to bottom with `entity_type` values `campaign`, `ad_set`, and
  `ad`. Obtain explicit approval immediately before activation.
- This path cannot duplicate an existing ad while preserving its social proof. Treat that as a
  manual Ads Manager workflow.

---

## Reference Files

- `references/campaign_templates.md` -- Full template specs for each campaign type (structural rules, targeting defaults, bid strategy guidance)
- `references/launch_checklist.md` -- Pre-launch validation checklist with pass/fail criteria
