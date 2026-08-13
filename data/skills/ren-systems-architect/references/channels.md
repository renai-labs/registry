# Channels

**What wakes Ren on each channel is in `references/composition.md`.** Design against that table;
this file is the mechanics. When a turn arrives from a channel, `<channel_context>` names that
platform's behaviour skill — load it before replying.

## Contents

- [Slack](#slack)
- [Telegram](#telegram)
- [Email](#email)
- [GitHub](#github)
- [Linear](#linear)
- [Speaking on a channel](#speaking-on-a-channel)

Every channel has two independent surfaces:

- **Inbound (mapping).** The message arrives as an ordinary Ren session turn and the reply streams
  back to the same thread. No channel MCP is required for inbound delivery.
- **Outbound (the channel MCP).** Ren initiates — posts, sends, reacts.

Facts common to all mappings:

- `fallbackSenderUserId` is a **pod member** — who a message is attributed to when the sender isn't a
  known Ren user. Unset or non-member and the turn is dropped.
- Installs are **org-level** regardless of where the project lives; a mapped project can sit in a
  private pod.
- Install returns a URL and there is **nothing to poll** — hand it over, then re-read `status`.

Do not attach, detach, or version system-owned channel MCPs through the client. User-created MCPs
belong on the project.

---

## Slack

```bash
ren slack install            # → { url }; then re-read status
ren slack status             # hasInstallation: true before anything else works
ren slack channels list      # only channels the bot can see — invite it to private ones first
ren slack channels set <channel-id> --project-id <prj_…> \
  --fallback-sender-user-id <usr_…>
ren slack channels unset <channel-id>
```

- One channel maps to **exactly one project**; a project can answer in many. Remapping a channel
  silently overwrites.
- An archived or deleted mapped project produces an **error reply**, not silence.
- MCP `slack` (`auth: "none"`): `slack_post_new_message`, `slack_reply_in_thread`, `slack_react`,
  `slack_read_channel_history`, `slack_read_thread`, `slack_list_channels`, `slack_list_users`,
  `slack_lookup_user`, `slack_edit_message`, `slack_delete_message`, `slack_upload_file`,
  `slack_get_reactions`. Live list: `ren mcps get-by-slug slack`.

## Telegram

One org-level bot. A chat is invisible until the bot is a member — start a DM or add it to the group.

```bash
ren telegram chats list
ren telegram chats set <chat-id> --project-id <prj_…> \
  --fallback-sender-user-id <usr_…> \
  [--topic-id <forum-topic>] [--allowed-senders <tg-user-id>] [--blocked-senders <tg-user-id>]
ren telegram claim-code --project-id <prj_…> …   # deep link; open it inside the target chat
ren telegram link-code | me | unlink             # bind a Telegram account to a Ren user
```

- `claim-code` is how you map a chat whose id you can't get — especially a DM.
- `--topic-id` maps a single forum topic instead of the whole group.
- Messages route to Ren for the mapped project; there is nothing to select in client setup.
- An unlinked sender runs as `fallbackSenderUserId`.
- **Only a reply to the bot continues a conversation**; any other new message starts a fresh session
  with no history. This explains most "it forgot" complaints.
- Documents and photos arrive as attachments, with text extracted, automatically.
- MCP `telegram` (`auth: "none"`): `telegram_send_message`, `telegram_send_document`,
  `telegram_react`. Tools take a `chatId` and, for forum topics, a `messageThreadId`.

## Email

The project mailbox — `<org_slug>.<project_slug>@…`, with a collision suffix — is the best bridge for
anything third-party that can send mail.

```bash
ren email set <prj_…> --fallback-sender-user-id <usr_…>
ren email list
ren email unset <prj_…>
```

- Read the address back from the response; don't compose it yourself.
- **To, Cc and Bcc are equal** — cc'ing the project on a live thread pulls Ren in.
- Replies are platform-managed back into the same thread. Threading uses a `+token` Ren mints on its
  own outbound mail; inbound without one falls back to the root `Message-ID`. Users never type a
  token address.
- Mailboxes are per project — never configured at pod or org level.
- MCP `email` (`auth: "none"`): `email_send`, for proactive mail after a cron or webhook run. Inbound
  needs no MCP.
- This is Ren's own mailbox, not Gmail automation. Scanning, labelling or acting in someone's inbox
  is Google Workspace.

## GitHub

Native integration; **there is no GitHub MCP**.

```bash
ren github install     # → url; the user picks which repos to grant
ren github status
ren github repos       # pick fullName from here
ren github mappings set <repo-id> --project-id <prj_…> --installation-id <id> \
  --repo-full-name <owner/repo> [--pr-listener-enabled] [--pr-listener-prompt "…"]
ren github connect     # re-link personal OAuth if a bind says "account not linked"
```

Two separate things:

- **Give Ren the code** — bind the repository to the project:
  read the project, add `{ "name": "api", "url": "https://github.com/<fullName>" }` to its existing
  `gitRepos`, then run `ren projects update <prj_…> --body @project-update.json`. The field is
  full-replace; sending only the new repository removes every existing binding. `baseBranch` and
  `description` are optional. Every session gets a fresh read-only checkout; branch a worktree inside
  the session directory, commit, push, and open a PR with `gh`.
- **Let comments and PRs wake it** — the repo mapping above.

Attribution: in a private pod both the Ren bot and the user claim the work (Ren stores the user's
GitHub OAuth credential at install); in a shared pod only the bot does. If the org installed against
selected repos, a repo missing from `ren github repos` needs another install pass.

## Linear

```bash
ren linear install | status | uninstall
ren linear projects
ren linear mappings create | list | remove <trigger-id>
```

Only Ren session events reach Ren — assigning it on an issue, or prompting it in an existing
session. Ordinary issue updates do not.

---

## Speaking on a channel

- Reply tools continue the conversation you were woken by. When **you** initiate — a cron run, or the
  user asking you to post — send to an explicit destination id from `<workspace_context>`.
- Channel turns are not interactive: no question tool. Ask inline and expect the answer next turn, or
  make the call and say what you did.
- Never handle a secret on a channel, and never relay a scope or auth error verbatim — say what to do
  and where.
