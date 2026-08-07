# Automated rule patterns and safe construction

## Important boundary

This reference intentionally does not provide copy-paste `evaluation_spec` or `schedule_spec`
payloads. Automated-rule schemas and accepted filter fields vary by Graph API version and account.
An invalid template can fail late; a valid but badly scoped template can change delivery across
more entities than intended.

The Ren tools enforce these top-level keys:

- `evaluation_spec`: `evaluation_type`, `filters`, `trigger`, `id`
- `schedule_spec`: `schedule`, `schedule_type`

Keys such as top-level `time_range`, `schedule_day`, and `schedule_time` are rejected. Nested filter,
trigger, schedule, and execution values still require verification for the target API/account.

## Required workflow

1. Call `meta_ads_adrule_list` and paginate through all existing rules.
2. Check whether an equivalent rule already exists.
3. Prefer copying the exact spec shape of a working rule from the same account.
4. If no suitable rule exists, build and validate it in Ads Manager or Graph Explorer first.
5. Scope the rule to explicit campaign/ad-set/ad IDs or an account-verified entity filter.
6. Present the complete name, scope, evaluation window, thresholds, action, schedule, and status.
7. Obtain explicit approval.
8. Create the rule `DISABLED` unless the user separately approves immediate enablement.
9. Read the created rule back with `meta_ads_adrule_list` and compare its stored specs.
10. Enable only after the user reviews that read-back.
11. Use `meta_ads_adrule_get_history` after enablement to confirm behavior.

Never translate the conceptual patterns below directly into JSON without steps 3 or 4.

## Pattern 1: high-cost pause guard

- Scope: explicit ad-set or ad IDs.
- Observation window: account-verified preset covering enough conversions for the business.
- Conditions: spend above a meaningful floor and cost per primary result above the agreed ceiling.
- Action: pause.
- Guardrails: exclude learning tests and entities launched too recently to meet the sample floor.

## Pattern 2: no-result spend guard

- Scope: explicit ad IDs.
- Conditions: spend above the agreed loss limit and zero primary results.
- Action: pause.
- Guardrails: use only when attribution delay is shorter than the observation window.

## Pattern 3: budget scale proposal

- Scope: explicit campaigns or ad sets with stable delivery.
- Conditions: primary KPI better than target, minimum result count met, and no active measurement
  warning.
- Action: increase budget by the user-approved percentage.
- Guardrails: cap the maximum daily budget and frequency of repeated increases.

Budget scaling rules can compound. Always show the worst-case budget after every possible execution
in the review.

## Pattern 4: budget reduction

- Scope: explicit campaigns or ad sets.
- Conditions: KPI worse than target after the agreed minimum sample.
- Action: reduce budget or notify; pausing is a separate decision.
- Guardrails: never reduce below the account's viable learning/delivery floor without warning.

## Pattern 5: notification-only anomaly

- Scope: explicit entities.
- Conditions: spend spike, delivery stop, or KPI excursion.
- Action: notification only.
- Guardrails: use notification-only rules when the evidence is too weak for an automatic mutation.

## Review checklist

- [ ] Existing rules fully paginated
- [ ] No duplicate or conflicting rule
- [ ] Entity scope is explicit and shown to the user
- [ ] Evaluation window verified for the target account
- [ ] Metric names and operators verified
- [ ] Action and maximum effect stated in plain language
- [ ] Attribution delay and sample floor considered
- [ ] Creation approval captured
- [ ] Created DISABLED unless enablement was separately approved
- [ ] Read-back matches the approved payload
- [ ] History review scheduled

## Unsupported request response

If no account-verified spec is available, say:

> I can design the rule and its guardrails, but I do not have a verified evaluation/schedule payload
> for this account. I will not invent one. Please create/export a disabled example in Ads Manager or
> validate the draft in Graph Explorer, then I can review and apply it.
