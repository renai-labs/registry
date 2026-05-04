---
name: google-workspace
description: "Gmail, Calendar, Drive, Docs, Sheets via the Google Python client. Reads a vault-issued OAuth access token from the environment."
version: 1.0.0
license: MIT
author: Ren Labs
---

# Google Workspace

Gmail, Calendar, Drive, Contacts, Sheets, and Docs — through the Google Python client libraries. Authentication is delegated to the platform vault: this skill reads a pre-issued OAuth access token from `$MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN` and never touches refresh tokens or runs an OAuth dance itself.

## When to Use

- send/search/read Gmail; manage labels and replies
- list, create, or delete Google Calendar events
- search Google Drive
- read or write Google Sheets ranges
- read Google Docs
- list Google Contacts

## Setup

Required Python packages:

```bash
pip install google-auth google-api-python-client
```

Required environment variable (injected by the platform from the user's connected Google Workspace vault credential):

- `MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN` — short-lived OAuth access token. The platform refreshes this server-side; the script reads whatever the env contains and never persists or rotates it.

If the env var is missing, every command exits 1 with `NOT_AUTHENTICATED:` to stderr — surface that to the user as "you need to connect your Google Workspace account in the vault".

The connected credential must include the scopes for the operations you call. The bundled commands cover Gmail (read/send/modify), Calendar (full), Drive (read), Contacts (read), Sheets (read/write), and Docs (read).

## Usage

All commands go through the API script. Set `GAPI` as a shorthand (run from this skill's directory):

```bash
GAPI="python3 scripts/google_api.py"
```

### Gmail

```bash
# Search (returns JSON array with id, from, subject, date, snippet)
$GAPI gmail search "is:unread" --max 10
$GAPI gmail search "from:boss@company.com newer_than:1d"
$GAPI gmail search "has:attachment filename:pdf newer_than:7d"

# Read full message (returns JSON with body text)
$GAPI gmail get MESSAGE_ID

# Send
$GAPI gmail send --to user@example.com --subject "Hello" --body "Message text"
$GAPI gmail send --to user@example.com --subject "Report" --body "<h1>Q4</h1><p>Details...</p>" --html
$GAPI gmail send --to user@example.com --subject "Hello" --from '"Research Agent" <user@example.com>' --body "Message text"

# Reply (automatically threads and sets In-Reply-To)
$GAPI gmail reply MESSAGE_ID --body "Thanks, that works for me."
$GAPI gmail reply MESSAGE_ID --from '"Support Bot" <user@example.com>' --body "Thanks"

# Labels
$GAPI gmail labels
$GAPI gmail modify MESSAGE_ID --add-labels LABEL_ID
$GAPI gmail modify MESSAGE_ID --remove-labels UNREAD
```

### Calendar

```bash
# List events (defaults to next 7 days)
$GAPI calendar list
$GAPI calendar list --start 2026-03-01T00:00:00Z --end 2026-03-07T23:59:59Z

# Create event (ISO 8601 with timezone required)
$GAPI calendar create --summary "Team Standup" --start 2026-03-01T10:00:00-06:00 --end 2026-03-01T10:30:00-06:00
$GAPI calendar create --summary "Lunch" --start 2026-03-01T12:00:00Z --end 2026-03-01T13:00:00Z --location "Cafe"
$GAPI calendar create --summary "Review" --start 2026-03-01T14:00:00Z --end 2026-03-01T15:00:00Z --attendees "alice@co.com,bob@co.com"

# Delete event
$GAPI calendar delete EVENT_ID
```

### Drive

```bash
$GAPI drive search "quarterly report" --max 10
$GAPI drive search "mimeType='application/pdf'" --raw-query --max 5
```

### Contacts

```bash
$GAPI contacts list --max 20
```

### Sheets

```bash
# Read
$GAPI sheets get SHEET_ID "Sheet1!A1:D10"

# Write
$GAPI sheets update SHEET_ID "Sheet1!A1:B2" --values '[["Name","Score"],["Alice","95"]]'

# Append rows
$GAPI sheets append SHEET_ID "Sheet1!A:C" --values '[["new","row","data"]]'
```

### Docs

```bash
$GAPI docs get DOC_ID
```

## Output Format

All commands return JSON. Parse with `jq` or read directly. Key fields:

- **Gmail search**: `[{id, threadId, from, to, subject, date, snippet, labels}]`
- **Gmail get**: `{id, threadId, from, to, subject, date, labels, body}`
- **Gmail send/reply**: `{status: "sent", id, threadId}`
- **Calendar list**: `[{id, summary, start, end, location, description, htmlLink}]`
- **Calendar create**: `{status: "created", id, summary, htmlLink}`
- **Drive search**: `[{id, name, mimeType, modifiedTime, webViewLink}]`
- **Contacts list**: `[{name, emails: [...], phones: [...]}]`
- **Sheets get**: `[[cell, cell, ...], ...]`

## References

- `references/gmail-search-syntax.md` — Gmail search operators (is:unread, from:, newer_than:, etc.). Read with the Read tool when crafting complex Gmail queries.

## Rules

1. **Never send email or create/delete events without confirming with the user first.** Show the draft content and ask for approval.
2. **Calendar times must include timezone** — always use ISO 8601 with offset (e.g., `2026-03-01T10:00:00-06:00`) or UTC (`Z`).
3. **Respect rate limits** — avoid rapid-fire sequential API calls. Batch reads when possible.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `NOT_AUTHENTICATED: $MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN is unset` | The user hasn't connected Google Workspace in the vault, or the pod wasn't linked to the vault. Direct them to the platform's connections UI. |
| `HttpError 401: Invalid Credentials` | Token expired between injection and use, or was revoked. The vault should auto-refresh; if not, ask the user to reconnect. |
| `HttpError 403: Insufficient Permission` | Connected credential is missing a scope for this operation. User must reconnect with broader scopes. |
| `HttpError 403: Access Not Configured` | The relevant Google API isn't enabled on the project backing the vault credential. Workspace admin needs to enable it in Google Cloud Console. |
| `ModuleNotFoundError: No module named 'google'` | `pip install google-auth google-api-python-client` is missing in the pod base image. |
