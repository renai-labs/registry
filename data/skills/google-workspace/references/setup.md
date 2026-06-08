# Setup

Google Workspace setup has two parts:

1. Save the org's Google OAuth app credentials in Ren.
2. Connect a user's Google account into a vault, usually the user's private vault.

After both are done, add the `google-workspace` skill to any agent that needs Gmail, Calendar, Drive, Sheets, Docs, or Contacts.

## Python packages

Required Python packages:

```bash
pip install google-auth google-api-python-client
```

## One-time Google Cloud OAuth app

Ren talks to Google as the user through a Google Cloud OAuth client that the org owns. This is a one-time setup and usually takes about 5 minutes.

Tell the user:

> You need a Google Cloud OAuth client. This is a one-time setup:
>
> 1. Create or select a project: https://console.cloud.google.com/projectselector2/home/dashboard
> 2. Enable the required APIs from the API Library: https://console.cloud.google.com/apis/library
>    Enable: Gmail API, Google Calendar API, Google Drive API, Google Sheets API, Google Docs API, People API.
> 3. Create the OAuth client here: https://console.cloud.google.com/apis/credentials
>    Credentials -> Create Credentials -> OAuth 2.0 Client ID; Application type: Web application.
> 4. Add this exact Authorized redirect URI:
>
>    `https://api.renai.build/api/google/oauth/callback`
>
> 5. Paste the Client ID and Client Secret back here. Ren encrypts and stores them as the org's Google OAuth app config.

Consent screen note: a Google Workspace org can usually mark the app Internal. A personal `gmail.com` account needs External. Configure it here: https://console.cloud.google.com/apis/credentials/consent

If the user prefers the web UI, send them to https://renai.build/app/settings/admin/integrations and have them complete the Google integration setup there.

## Save the Ren org config

Once the user gives you the Client ID and Client Secret, save them as the org-level Google config:

```bash
ren google config save --client-id <client-id> --client-secret <client-secret> --output json
```

The config is org-level by default. Do not put the user's personal Google account tokens here; this step stores only the OAuth app credentials. The secret is encrypted at rest.

Check whether the org config exists:

```bash
ren google status --output json
```

## Connect Google in a vault

After the org config exists, connect the user's Google account into a vault. Default to a private user vault because Google Workspace data is usually personal user data. Use an org vault only when the user explicitly asks for org/shared access.

Find the user's private default vault:

```bash
ren vaults list --scope user --output json
```

Use the default user vault id, then start the Google connect flow:

```bash
ren google connect <vault-id> --scope user --output json
```

Open or give the returned authorization URL to the user and have them finish Google consent. The vault stores the resulting OAuth credential and refreshes it server-side.

## Use from an agent

Once the org config is saved and the vault connection is complete, add the `google-workspace` skill to any agent that should use Google services. The skill expects the platform to inject:

Required environment variable (injected by the platform from the user's connected Google Workspace vault credential):

- `MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN` — short-lived OAuth access token. The platform refreshes this server-side; the script reads whatever the env contains and never persists or rotates it.

If the env var is missing, every command exits 1 with `NOT_AUTHENTICATED:` to stderr — surface that to the user as "you need to connect your Google Workspace account in the vault".

The connected credential must include the scopes for the operations you call. The bundled commands cover Gmail (read/send/modify), Calendar (full), Drive (read/write/share/delete), Contacts (read), Sheets (read/write/create), and Docs (read/write/create).
