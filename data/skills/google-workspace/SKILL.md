---
name: google-workspace
description: >-
  Gmail, Calendar, Drive, Docs, Sheets via the Google Python client. Reads a
  vault-issued OAuth access token from the environment.
license: MIT
metadata:
  author: Ren Labs
  icon: 'https://cdn.renai.build/skill-icons/google-workspace.svg'
  tags:
    - productivity
---

# Google Workspace

Gmail, Calendar, Drive, Contacts, Sheets, and Docs — through the Google Python client libraries. Authentication is delegated to the platform vault: this skill reads a pre-issued OAuth access token from `$MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN` and never touches refresh tokens or runs an OAuth dance itself.

## When to Use

- send/search/read Gmail; manage labels and replies
- list, create, or delete Google Calendar events
- search, read, upload, download, share, or delete Google Drive files
- create Google Sheets files; read, update, or append ranges
- create, read, or append Google Docs
- list Google Contacts

## Setup

See `references/setup.md` for the Google Cloud OAuth app setup, Ren org config, private vault connect flow, pip install, the required `MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN` env var, and the credential scopes bundled commands rely on.

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
# Search existing files
$GAPI drive search "quarterly report" --max 10
$GAPI drive search "mimeType='application/pdf'" --raw-query --max 5

# Get metadata for a single file
$GAPI drive get FILE_ID

# Upload a local file (auto-detects MIME type)
$GAPI drive upload /path/to/report.pdf
$GAPI drive upload /path/to/image.png --name "Logo.png" --parent FOLDER_ID

# Download (binary files download as-is; Google-native files export to a
# sensible default: Docs->pdf, Sheets->csv, Slides->pdf, Drawings->png)
$GAPI drive download FILE_ID
$GAPI drive download DOC_ID --output ~/doc.pdf
$GAPI drive download DOC_ID --export-mime text/plain --output ~/doc.txt

# Create a folder
$GAPI drive create-folder "Reports"
$GAPI drive create-folder "Q4" --parent FOLDER_ID

# Share
$GAPI drive share FILE_ID --email alice@example.com --role reader
$GAPI drive share FILE_ID --email alice@example.com --role writer --notify
$GAPI drive share FILE_ID --type anyone --role reader
$GAPI drive share FILE_ID --type domain --domain example.com --role reader

# Delete (defaults to trash; use --permanent to skip trash)
$GAPI drive delete FILE_ID
$GAPI drive delete FILE_ID --permanent
```

### Contacts

```bash
$GAPI contacts list --max 20
```

### Sheets

```bash
# Create spreadsheet
$GAPI sheets create --title "Q4 Budget"
$GAPI sheets create --title "Inventory" --sheet-name "Stock"

# Read
$GAPI sheets get SHEET_ID "Sheet1!A1:D10"

# Write
$GAPI sheets update SHEET_ID "Sheet1!A1:B2" --values '[["Name","Score"],["Alice","95"]]'

# Append rows
$GAPI sheets append SHEET_ID "Sheet1!A:C" --values '[["new","row","data"]]'
```

### Docs

```bash
# Read
$GAPI docs get DOC_ID

# Create a new Doc (optionally seeded with body text)
$GAPI docs create --title "Meeting Notes"
$GAPI docs create --title "Draft" --body "First paragraph..."

# Append text to the end of an existing Doc
$GAPI docs append DOC_ID --text "Additional content to append"
```

## Output Format

All commands return JSON. Parse with `jq` or read directly. Key fields:

- **Gmail search**: `[{id, threadId, from, to, subject, date, snippet, labels}]`
- **Gmail get**: `{id, threadId, from, to, subject, date, labels, body}`
- **Gmail send/reply**: `{status: "sent", id, threadId}`
- **Calendar list**: `[{id, summary, start, end, location, description, htmlLink}]`
- **Calendar create**: `{status: "created", id, summary, htmlLink}`
- **Drive search**: `[{id, name, mimeType, modifiedTime, webViewLink}]`
- **Drive get**: `{id, name, mimeType, modifiedTime, size, webViewLink, parents, owners}`
- **Drive upload**: `{status: "uploaded", id, name, mimeType, webViewLink}`
- **Drive download**: `{status: "downloaded", id, name, path, mimeType}`
- **Drive create-folder**: `{status: "created", id, name, webViewLink}`
- **Drive share**: `{status: "shared", permissionId, fileId, role, type}`
- **Drive delete**: `{status: "trashed" | "deleted", fileId, permanent}`
- **Contacts list**: `[{name, emails: [...], phones: [...]}]`
- **Sheets create**: `{status: "created", spreadsheetId, title, spreadsheetUrl}`
- **Sheets get**: `[[cell, cell, ...], ...]`
- **Sheets update/append**: `{updatedCells, ...}`
- **Docs get**: `{title, documentId, body}`
- **Docs create**: `{status: "created", documentId, title, url}`
- **Docs append**: `{status: "appended", documentId, inserted_at, characters}`

## References

- `references/setup.md` — pip install, required env var, and credential scopes. Read with the Read tool when bootstrapping a new pod or debugging auth errors.
- `references/gmail-search-syntax.md` — Gmail search operators (is:unread, from:, newer_than:, etc.). Read with the Read tool when crafting complex Gmail queries.

## Rules

1. **Never send email, create/delete calendar events, delete Drive files, share files, or modify Docs/Sheets without confirming with the user first.** Show what will be done: recipients, event times, file IDs, content changes, share role, or delete mode.
2. **Prefer reversible Drive deletes.** Use the default trash behavior unless the user explicitly confirms `--permanent`.
3. **Check auth before first use.** If a command fails with `NOT_AUTHENTICATED`, direct the user to connect Google Workspace in the platform vault; do not run an OAuth flow in the skill.
4. **Use the Gmail search syntax reference for complex queries.** Read `references/gmail-search-syntax.md` when crafting precise Gmail searches.
5. **Calendar times must include timezone** — always use ISO 8601 with offset (e.g., `2026-03-01T10:00:00-06:00`) or UTC (`Z`).
6. **Respect rate limits** — avoid rapid-fire sequential API calls. Batch reads when possible.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `NOT_AUTHENTICATED: $MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN is unset` | The user hasn't connected Google Workspace in the vault, or the pod wasn't linked to the vault. Direct them to the platform's connections UI. |
| `HttpError 401: Invalid Credentials` | Token expired between injection and use, or was revoked. The vault should auto-refresh; if not, ask the user to reconnect. |
| `HttpError 403: Insufficient Permission` | Connected credential is missing a scope for this operation. User must reconnect with broader scopes. |
| `HttpError 403` after adding write/delete operations | New Drive write/delete or Docs/Sheets modify capabilities may require re-authorization with upgraded scopes. Ask the user to reconnect Google Workspace in the platform vault. |
| `HttpError 403: Access Not Configured` | The relevant Google API isn't enabled on the project backing the vault credential. Workspace admin needs to enable it in Google Cloud Console. |
| `ModuleNotFoundError: No module named 'google'` | `pip install google-auth google-api-python-client` is missing in the pod base image. |
