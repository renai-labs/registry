# Data Requirements: audit-measurement

## Dataset discovery and identity

Call `meta_ads_get_datasets` with the numeric `ad_account_id`. Follow the returned cursor until the
configured dataset is found. Then call `meta_ads_get_dataset_details` with `dataset_id` to verify
its name, status, ownership, `last_fired_time`, and `server_last_fired_time`.

Flag a configured pixel or dataset ID that is absent, inactive, owned by the wrong business, or
stale relative to active campaigns.

## Event volume

Call `meta_ads_get_dataset_stats`:

```
dataset_id: {dataset_id}
start_time: {unix_timestamp_no_more_than_28_days_ago}
end_time: {current_unix_timestamp}
aggregation: "event"
```

The tool is capped at the last 28 days. Use separate calls with `event_source: "WEB_ONLY"` and
`event_source: "SERVER_ONLY"` to compare browser and server volume when both are expected. Use
`event_name` to isolate Purchase, Lead, AddToCart, ViewContent, InitiateCheckout, or
CompleteRegistration.

## Signal quality and freshness

The mounted Meta MCP does not expose EMQ or match-key coverage. Collect an Events Manager export or
screenshot and review:

- event-level EMQ composite score;
- email, phone, external ID, IP address, user agent, and other match-key coverage;
- upload frequency and freshness;
- differences between web, offline, CRM, and custom-attribution channels.

Do not substitute `meta_ads_get_dataset_stats`: event volume does not prove match quality,
deduplication, upload regularity, or consent behavior. If evidence is unavailable, mark every item
above **not verified** rather than estimating it.

## Custom conversions

Use `meta_ads_get_customconversions` to inventory existing custom conversions, optionally filtered
by `dataset_id`. Before proposing a new one, confirm that an equivalent conversion does not already
exist.

After explicit approval, create one with:

```
MCP tool: meta_ads_create_custom_conversion
ad_account_id: {numeric_ad_account_id}
name: {conversion_name}
event_source_id: {dataset_id}
custom_event_type: {PURCHASE | LEAD | COMPLETE_REGISTRATION | OTHER}
rule: '{"event":{"i_contains":"TrialStarted"}}'
```

The mutation is immediate; there is no draft layer.

## Attribution and ad configuration

For reporting comparisons, call `meta_ads_get_field_context` and then
`meta_ads_get_ad_entities`. Include `id` and `name` in every fields array. Use `level:
"ad_account"` without filtering or sorting for account totals. Use `level: "ad"` to inspect
`creative`, `effective_status`, and supported conversion metrics.

Use `results` and `cost_per_result` for objective-level reporting. `action_values` is an
action-type breakdown, while `purchase_roas` is purchase-specific; do not present either as a
generic objective result value or ROAS.

## Manual evidence required

Collect screenshots or exports for evidence the MCP does not expose:

1. Events Manager diagnostics and active warnings.
2. Browser/server deduplication rate and `event_id` behavior.
3. Test Events results.
4. Consent mode, Limited Data Use, and privacy controls.
5. Domain verification and aggregated-event settings where applicable.
6. CRM or backend totals for reconciliation against Meta reporting.
