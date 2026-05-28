# OAuth refresh — how stored tokens stay alive

Read when an OAuth credential stops working, when you're debugging "token expired" symptoms, or when the user asks how long they can leave a Ren agent running without re-auth.

## Lazy, not scheduled

Ren does **not** run a background job to refresh tokens. Refresh happens **only when the token is resolved** — that is, when an agent that needs it is about to run. The pod's sandbox requests a fresh manifest roughly every two minutes while it's live, and every resolution checks the credential's `expiresAt`:

- Token still valid (and not within ~10 min of expiry) → use as-is.
- Token expired or within ~10 min of expiry → run a `refresh_token` grant against the provider's token endpoint, write the rotated token back to the credential row (re-encrypted), then hand out the new value.

Result: a running sandbox effectively always has a valid access token, because the next manifest cycle will refresh before the old one runs out.

## When refresh fails

Refresh only saves you while the **refresh token** itself is valid. Providers can revoke it for many reasons — user revokes the integration from their account, the app's client secret rotates, the refresh token's TTL expires, the user changes password (on some providers).

When the grant fails:

- The credential is left in place with its stale tokens; resolution returns the stale `accessToken` which the provider then 401s.
- You'll see `failureReason: "refresh_failed"` or a provider error in the credential row's last refresh attempt.
- The fix is a fresh OAuth connect: `ren mcps oauths connect <mcp-id>` overwrites the credential with newly-minted tokens.

## What you don't need to do

- Don't run cron jobs to refresh tokens. Resolution does it.
- Don't store the access token anywhere — every time you resolve, the platform refreshes if needed.
- Don't try to refresh from your code. The grant requires the encrypted refresh token, which never leaves the server.
