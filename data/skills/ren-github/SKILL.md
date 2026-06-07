---
name: ren-github
description: >-
  Connect GitHub to Ren - install the org's GitHub App, list accessible repos,
  and bind a repo to a project so the agent gets it mounted. Use when the user
  wants their Ren agent to work against a GitHub repository.
metadata:
  icon: 'https://cdn.renai.build/skill-icons/github.svg'
  tags:
    - ren
    - code
---

# GitHub Dev

Connecting GitHub is two moves: **install the GitHub App on the org** (grants repo access), then **bind a repo to a project** so the project's agent gets it mounted. Installs and repo access are **org-level** — they live on the org, not a single user's pod.

> Commands and flags (`github status / install / repos / connect / uninstall`, `projects update` with `gitRepo`): `ren docs commands`.

## Runtime behavior

The org's GitHub App installation gives Ren repo access. When a project's `gitRepo.url` points at a repo the installation can reach, Ren mints an installation token at agent startup and mounts the working tree at `mountPath` — nothing to re-paste.

- Installation happens at the **org level**.
- When a repo is attached to a org pod project, the Ren bot is attributed directly (no, user attribution)
- When a repo is attached to a private pod project, then user's oauth credentials are attributed to the commits and github actions.
- During installation Ren auto-creates the user's GitHub OAuth credentials and stores them in their default private vault (attached to their private pod).

## The install loop — no polling

`install` and `connect` return `{ "url": "…" }` and **there is no poll endpoint** (unlike the vault OAuth flow in [[ren-vaults-credentials-dev]]). Hand the user the URL, let them complete it in the browser (the App install page is where they choose which repos to grant), then verify with `github status`. Don't loop a session call — re-read `status` once they're done.

## Binding a repo

`gitRepo` is nested, so it goes through `--body` on `projects update` (see [[ren-project-dev]]). `url` is the only required field; `baseBranch` and `mountPath` are optional. Pick the `url` from a `github repos` `fullName` (`https://github.com/<fullName>`). `github connect` is a fallback to re-link personal OAuth if a bind says "account not linked" — skip it during onboarding.

## Scope

The install and its repo grants are **org-level** — keyed to the caller's org regardless of any `--scope user` flag — but the project that mounts the repo must live in a user-private pod (see Runtime behavior). General scope rules: `ren docs model`.

## Gotchas

- **Selected-repos installs.** If the user installed against specific repos (not "all"), a repo you don't see in `github repos` won't bind — they re-run `github install` to add it.
- **`status` is the source of truth.** After the browser flow there's nothing to poll — re-read `github status` (`hasInstallation` / `hasUserCredential`) before binding.

## Next steps

- **Bind the repo to a private-pod project** and open a session — the working tree mounts at `mountPath`. See [[ren-project-dev]].
- **Wire Slack** if the user also wants channel-driven triggers. See [[ren-slack]].
