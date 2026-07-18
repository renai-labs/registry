---
name: splitwise-expenses
description: Track and manage expenses on Splitwise via its REST API — record expenses, list recent ones, and check balances with friends and groups.
---

# Splitwise Expense Tracking

Minimal guide for tracking expenses on Splitwise through the Self-Serve API
(https://dev.splitwise.com/). Covers the common flows: adding an expense,
listing recent expenses, and reading balances.

## Authentication

All requests go to `https://secure.splitwise.com/api/v3.0/` and require a bearer
token. Use a personal **API key** from https://secure.splitwise.com/apps (create
an app, then copy the API key).

Send it as a header on every request:

```
Authorization: Bearer <API_KEY>
```

Store the key as an environment variable (e.g. `SPLITWISE_API_KEY`); never hard-code
or print it.

## Core concepts

- **Expense** — a cost split among users. Each has a `cost`, `description`,
  `currency_code`, optional `group_id`, and per-user `paid_share`/`owed_share`.
- **Group** — a set of users sharing expenses. Non-group expenses use `group_id: 0`.
- **Amounts are strings**, e.g. `"25.00"`. For every expense, the sum of all
  `paid_share` values and the sum of all `owed_share` values must each equal `cost`.

## Bootstrapping IDs

Before creating expenses you usually need the current user's ID, plus friend or
group IDs.

```bash
BASE=https://secure.splitwise.com/api/v3.0
AUTH="Authorization: Bearer $SPLITWISE_API_KEY"

# Who am I? (returns your user id)
curl -s -H "$AUTH" "$BASE/get_current_user"

# List groups (id + name + members)
curl -s -H "$AUTH" "$BASE/get_groups"

# List friends (id + name + balance)
curl -s -H "$AUTH" "$BASE/get_friends"
```

## Create an expense

Send JSON with `Content-Type: application/json`.

### Split equally within a group (simplest)

Only works when `group_id` is a real group (not 0).

```bash
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "$BASE/create_expense" -d '{
    "cost": "25.00",
    "description": "Grocery run",
    "currency_code": "USD",
    "group_id": 391,
    "split_equally": true
  }'
```

### Explicit shares (works with or without a group)

List each participant with `paid_share` and `owed_share`, flattened as
`users__{index}__{property}`. Identify a user by `user_id` (or first/last/email
for someone not yet a friend). Paid shares sum to `cost`; owed shares sum to `cost`.

Example: you (id 54123) paid $25, split as $13.55 you / $11.45 them.

```bash
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "$BASE/create_expense" -d '{
    "cost": "25.00",
    "description": "Dinner",
    "currency_code": "USD",
    "group_id": 0,
    "users__0__user_id": 54123,
    "users__0__paid_share": "25.00",
    "users__0__owed_share": "13.55",
    "users__1__user_id": 98765,
    "users__1__paid_share": "0.00",
    "users__1__owed_share": "11.45"
  }'
```

Optional fields: `date` (ISO 8601), `category_id`, `details` (notes),
`repeat_interval` (`never`|`weekly`|`monthly`|`yearly`).

**Check the response**: a successful create returns `{"expenses": [...], "errors": {}}`.
If `errors` is non-empty, the expense was NOT created — inspect and fix.

## List / read expenses

```bash
# Recent expenses (default limit 20). Filter by group, date, or paging.
curl -s -H "$AUTH" "$BASE/get_expenses?limit=20"
curl -s -H "$AUTH" "$BASE/get_expenses?group_id=391&limit=50"
curl -s -H "$AUTH" "$BASE/get_expenses?dated_after=2026-01-01T00:00:00Z"

# One expense by id
curl -s -H "$AUTH" "$BASE/get_expense/51023"
```

Query params for `get_expenses`: `group_id`, `friend_id`, `dated_after`,
`dated_before`, `updated_after`, `updated_before`, `limit` (default 20),
`offset` (default 0).

Each expense includes `repayments` (who owes whom) and per-currency amounts.

## Update / delete

```bash
# Update — only send changed fields. Supplying any users__ share overwrites ALL shares.
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "$BASE/update_expense/51023" -d '{"cost":"30.00","description":"Dinner (updated)"}'

# Delete (soft) / restore
curl -s -X POST -H "$AUTH" "$BASE/delete_expense/51023"
curl -s -X POST -H "$AUTH" "$BASE/undelete_expense/51023"
```

## Balances

There is no dedicated balance endpoint — read balances from friends and groups:

```bash
# Net balance with each friend (positive = they owe you)
curl -s -H "$AUTH" "$BASE/get_friends"

# Balances within a group (per member, per currency)
curl -s -H "$AUTH" "$BASE/get_group/391"
```

## Reference

- Categories: `GET /get_categories` (use a subcategory id when creating expenses).
- Currencies: `GET /get_currencies`.
- Full docs: https://dev.splitwise.com/

## Tips & gotchas

- 200 OK does not always mean success — check the `success` or `errors` field in
  the body for create/update/delete/group operations.
- Amounts must be strings and the paid/owed sums must each equal `cost`, or you'll
  get a validation error in `errors`.
- `split_equally` requires a real `group_id`; for one-on-one splits use explicit shares.
- Rate limits are conservative; batch reads and avoid tight polling loops.
- Never log or echo the API key.
