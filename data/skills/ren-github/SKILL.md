---
name: ren-github
description: >-
  Connect GitHub to Ren - install the org's GitHub App, list accessible repos,
  and bind a repo to a project so the agent gets it mounted. Use when the user
  wants their Ren agent to work against a GitHub repository.
metadata:
  icon: "https://cdn.renai.build/skill-icons/github.svg"
  tags:
    - ren
    - code
---

# GitHub Dev

> There is **no GitHub MCP**. GitHub is a native Ren integration; you must install the Ren GitHub bot in your org.

Connecting GitHub is two moves: **install the GitHub App on the org** (grants repo access), then **bind a repo to a project** so the project's agent gets it mounted.

> Commands and flags (`github status / install / repos / connect / uninstall`, `projects update` with `gitRepo`): `ren docs commands`.

## The install loop

`ren github install` returns `{ "url": "…" }`. Hand the user the URL, let them complete it in the browser (the App install page is where they choose which repos to grant), then verify with `ren github status`. **There is no poll endpoint** — re-read `status` once they're done.

## Binding a repo

`gitRepo` is nested, so it goes through `--body` on `projects update` (see [[ren-systems-architect]]). `url` is the only required field; `baseBranch` and `mountPath` are optional. Pick the `url` from `ren github repos` using the `fullName` field.

```bash
ren projects update <project-id> --body '{"gitRepo":{"url":"https://github.com/<fullName>"}}'
```

Open a session — Ren mints an installation token and mounts the working tree at `mountPath`. The project must live in a **user-private pod**; org pods mount the repo but do not get user-attributed commits.

Also, explain to the user that every new session on this ren project will have a fresh clone of the github repo to work out of

`github connect` is a fallback to re-link personal OAuth if a bind says "account not linked" — skip it during onboarding.

## Attribution

- **Org project**: the Ren GitHub bot claims attribution. There is **no user attribution**.
- **Private project**: if the user has performed OAuth, both the Ren bot and the user claim attribution for the actions.
- During installation Ren auto-creates the user's GitHub OAuth credentials and stores them in their default private vault.

## Gotchas

- **Selected-repos installs.** If the user installed against specific repos (not "all"), a repo you don't see in `github repos` won't bind — they re-run `github install` to add it.
