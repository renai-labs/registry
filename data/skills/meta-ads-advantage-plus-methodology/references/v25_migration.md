# Advantage+ API-version verification guide

## Purpose

Advantage+ creation and migration behavior changes through product rollouts as well as Graph API
versions. Do not use a static date or an expected rollout as proof that a legacy or unified payload
is available for a particular ad account.

## Required verification

Before recommending or executing a migration:

1. Record the Graph API version used by the mounted Meta MCP.
2. Inspect the existing campaign in Ads Manager and record its objective, effective status,
   budget, bid strategy, and the Advantage state displayed by Meta.
3. Check Meta's current Marketing API changelog and Advantage+ campaign documentation for that
   version and account.
4. Use Graph Explorer or a non-production test account to validate the exact creation payload with
   `status: "PAUSED"`.
5. Treat account-specific rollout flags as unknown until the test request succeeds.

## Current MCP boundary

The Ren `meta_ads_create_campaign` contract does not expose a verified, dedicated unified
Advantage+ creation recipe. Therefore:

- analysis of existing Advantage+ campaigns is allowed;
- budget/status changes may be proposed through `meta_ads_update_entity` after field verification;
- creation, duplication, or migration of an Advantage+ campaign must be completed in Ads Manager
  or deferred until a paused Graph payload has been verified for the target account;
- never pass the legacy label `ADVANTAGE_SHOPPING_CAMPAIGN` merely because a template contains it.

## Safe migration plan

When current documentation and a paused test prove that migration is supported:

1. Export the legacy campaign's configuration and reporting baseline.
2. Build the replacement PAUSED.
3. Verify objective, attribution, optimization event, customer definition, geo controls, catalog,
   creative, and budget.
4. Preview every ad.
5. Obtain explicit approval before activation.
6. Run a controlled comparison with a predeclared KPI, minimum sample, and rollback condition.
7. Shift budget gradually only when the evidence supports it.
8. Keep historical campaigns PAUSED rather than deleting them unless the user explicitly approves
   deletion.

## Reporting language

Use:

> Creation/migration availability is not verified for this account. The current MCP can analyze the
> existing campaign, but a paused test in Ads Manager or Graph Explorer is required before build.

Do not use:

- "mandatory by" dates copied from old rollout material;
- expected Q3/Q4 behavior as fact;
- claims that existing campaigns can or cannot be edited without checking the current account;
- guaranteed performance improvements from migration.
