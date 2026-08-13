# Credentials

Secrets live encrypted in a vault and are injected as environment variables at run time. They never
appear in prompts, and you never collect one in a conversation.

## Contents

- [Three vaults](#three-vaults-and-nobody-creates-them)
- [Credential resolution](#what-a-pod-resolves)
- [Missing credentials](#where-a-missing-credential-goes)
- [Adding a credential](#adding-one)
- [OAuth](#oauth)
- [Resolution rules](#rules-that-decide-whether-resolution-works)

## Three vaults, and nobody creates them

A vault belongs to one container and is created and destroyed with it. There is no create, rename,
attach, delete or priority — and no "which vault?" question to ask.

| Vault        | Belongs to       | How many               | Who can reach it                            |
| ------------ | ---------------- | ---------------------- | ------------------------------------------- |
| **Org**      | the organisation | one                    | any org member                              |
| **Pod**      | a shared pod     | one per shared pod     | that pod's members only — no admin override |
| **Personal** | a person         | one per person per org | the owner only                              |

Roles: `readonly` lists and sees previews, `member` writes/deletes/transfers, `admin` manages OAuth
apps. **No role can read a secret back through the API**, including you.

## What a pod resolves

- **Shared pod** → its own vault, then the org vault.
- **Private pod** (the user's DM) → their personal vault, then every shared pod they belong to
  (oldest first), then the org vault.

Membership is read at call time, so joining or leaving a pod changes that person's DM immediately.

```bash
ren pods credentials list <pod_…>    # resolved view, best match first
ren vaults list / ren vaults get <vlt_…>
```

The response carries each entry's tier, a `shadowed` flag on anything losing to a higher-priority
entry, and `writeVaultId` — where a new credential for this pod belongs.

For the other direction — what this pod still **needs** rather than what it holds:

```bash
ren pods auth-requirements <pod_…> --output json
```

It aggregates every project in the pod, evaluates `satisfied` against the whole vault chain, and
names in `neededBy` which skills and MCPs asked for each one. One call answers "what is this team
missing" without opening a session.

## Where a missing credential goes

The user adds it in the app; you never take it in the conversation. Name the service, hand the link,
hold the work so it resumes.

```
<base>/pods/<pod-id>/vaults     the pod's own credentials — shared pod or private pod alike
<base>/vaults                   the org's credentials, shared by every pod
```

`<base>` is `${REN_APP_URL}` when a shell resolves it, otherwise `https://renai.build/app`. The pod
id is in `<workspace_context>`; for a user's own private pod, read the id from `ren topology get`.

Wire the skill or MCP first, then send them. Once it is attached, `ren pods credentials list <pod_…>`
names exactly what is unresolved — hand that list and the link together, so the only thing left for
them to do is authorize. Say that what they add lands on your next session.

On a trigger turn nobody is present: surface the gap, do what you can without it, stop.

## "Missing" can mean revoked

A fatal OAuth refresh — revoked integration, expired refresh token, rotated client secret, on some
providers a password change — **hard-deletes the credential**. No archive, no tombstone. An
automation that worked for months can stop with the credential simply gone. Read absence that way
before telling someone they never set it up; the fix is a fresh connect.

## Adding one

```bash
printf %s "$TOKEN" | ren credentials create <vlt_…> --auth-type bearer --mcp-id <mcp_…> --token-stdin
printf %s "$PW"    | ren credentials create <vlt_…> --auth-type basic  --mcp-id <mcp_…> --username me --password-stdin
REN_CREDENTIAL_SECRET=sk-… ren credentials create <vlt_…> --auth-type env --label OPENAI_API_KEY
```

Secrets go in through stdin or the environment, never as a flag value on a shared shell line. The
`env` label is the variable name a skill reads; `--mcp-id` anchors a bearer/basic credential to an
MCP.

## OAuth

```bash
ren credentials connect <mcp_…> --vault-id <vlt_…> --json --no-open
```

One command: it prints the authorization URL, polls, and exits 0 on success or 1 on failure. The
whole exchange is server-side — you never see or paste a token.

- **Run connects one at a time.** Never start two concurrently, even for different MCPs, and never
  fire one while another is polling. Each connect mints its own URL; a stale one fails at the
  provider ("Missing redirect_uri"). Surface exactly one URL — the latest.
- Sessions expire after **10 minutes**; `expired` or `failed` means start over.
- Some providers show a "you will be redirected…" interstitial — tell the user to click through it.
- If the provider's OAuth server can't do dynamic client registration, connect fails with
  "Incompatible auth server". Stop; send them to `<base>/pods/<pod-id>/vaults` to connect it there.
  Retrying over the CLI cannot help.
- Google Workspace has its own pair: `ren google connect <vlt_…>` / `ren google status`.

**Refresh is lazy and server-side.** Nothing runs a cron for it: every resolution refreshes a token
that is expired or within ten minutes of expiring, and writes the rotated value back. A live sandbox
therefore always has a valid token. A token with no expiry is never auto-refreshed. A non-fatal
refresh failure leaves the stale token in place, so the symptom is a provider 401 rather than a Ren
error; a fatal one deletes the credential (above). Either way the fix is a fresh connect. Don't store
tokens, don't refresh from your own code, don't schedule anything to do it.

## Rules that decide whether resolution works

- **The name must match exactly.** A credential's env label becomes the variable name **verbatim** —
  no normalisation. It must equal the skill's `requiredCredentials` entry or the env var Ren derives
  from an MCP's slug (`references/authoring.md`). A mismatch doesn't error: the variable is absent and
  the call fails later.
- **Shadowing is first-vault-wins** down the resolution order. A personal credential shadows the org
  one of the same name in that person's DM; say which account was used when the answer depends on it.
- **One account per service, per container** — a shared pod has exactly one Google Workspace
  connection, whoever set it up. "Check my calendar" in a team channel reads that account.
- **Personal credentials never reach a shared pod.**
- **Kind is immutable** — rotate the secret, don't change a bearer into a basic pair.
- **Cap: 100 credentials per vault.** The org vault serves the whole company and hits it first.
- Facade MCPs (`slack`, `telegram`, `email`) are `auth: "none"` — they act as the org's installed
  bot. Adding a vault credential for them does nothing and masks real wiring errors.
- Archiving a shared pod **destroys its vault**: membership was the only way to reach those
  credentials. Say so before archiving.
