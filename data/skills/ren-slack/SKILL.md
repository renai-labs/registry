---
name: ren-slack
description: >-
  Connect Slack to Ren - install the workspace, list channels, and map a channel
  to a project so messages route to its agent. Use when the user wants to drive a
  Ren agent from Slack.
metadata:
  icon: 'https://cdn.renai.build/skill-icons/slack.svg'
  tags:
    - ren
    - productivity
---

# Slack Dev

Connecting Slack is two moves: **install the workspace** (org-level OAuth), then **map a channel to a project** so messages in that channel route to the project's agent. Installs and channel mappings are **org-level** — they live on the org, not a single user's pod.

> Commands and flags (`slack status / install / channels list|set|unset / uninstall`): `ren docs commands`.

## Runtime behavior

A channel mapping binds one Slack channel to one project. When someone posts in a mapped channel, Ren routes the message to the project's chosen agent and runs a session — the reply streams back into the thread. The mapping carries three things the runtime needs: which **project**, which **agent** in it answers, and who a message is **attributed to** when the Slack sender can't be resolved to a Ren user.

## The install loop — no polling

`install` returns `{ "url": "…" }` and **there is no poll endpoint** (unlike the vault OAuth flow in [[ren-vaults-credentials-dev]]). Hand the user the URL, let them complete the workspace OAuth consent in the browser, then verify with `slack status`. Don't loop a session call — re-read `status` once they're done.

## Mapping a channel — the three ids

`channels set` needs all three (validated server-side):

- **`projectId`** — the project that answers in this channel.
- **`defaultProjectAgentId`** — the **`pra_` attachment id**, *not* the agent id. Get it from `ren projects agents list <project-id>` (same gotcha as triggers, see [[ren-trigger-dev]]). Must be an agent attached to that project.
- **`fallbackSenderUserId`** — a **pod member** user id; who a message is attributed to when the Slack sender isn't a known Ren user. During onboarding, default this to the onboarding user themselves.

## Scope

Slack is **org-level**: the install and its channel mappings are keyed to the caller's org regardless of any `--scope user` flag. The project a channel maps to can still live in a user-private pod. General scope rules: `ren docs model`.

## Gotchas

- **`pra_`, not `agt_`.** `defaultProjectAgentId` is the project-agent attachment id from `projects agents list`, not the agent id. The wrong one fails validation.
- **The bot must be in the channel.** `channels list` only returns channels the Ren bot can see — a private channel won't appear until the user invites the bot to it.
- **`status` is the source of truth.** After the user finishes the browser flow, re-read `slack status` (`hasInstallation: true`) before mapping — there's nothing to poll.

## Next steps

- **Map a channel to a project**, then post in it to confirm the agent answers. See [[ren-project-dev]].
- **Run it unattended** with a cron trigger if the user wants scheduled posts as well as on-demand. See [[ren-trigger-dev]].
- **Wire GitHub** if the agent also needs a repo. See [[ren-github]].
