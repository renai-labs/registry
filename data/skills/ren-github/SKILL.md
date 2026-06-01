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

## Runtime behavior

The org's GitHub App installation gives Ren repo access. When a project's `gitRepo.url` points at a repo the installation can reach, Ren mints an installation token at agent startup and mounts the working tree at `mountPath` — nothing to re-paste.

- github installation happens at the org level
- only private pod's projects are allowed to use github as a project resource
- during installation, we autocreate the user's github oauth credentials and store them in their defualt private vault(attached to their private pod)

## The install loop — no polling

`install` and `connect` return `{ "url": "…" }` and **there is no poll endpoint** (unlike the vault OAuth flow in [[ren-vaults-credentials-dev]]). Hand the user the URL, let them complete it in the browser (the App install page is where they choose which repos to grant), then verify with `github status`. Don't loop a session call — re-read `status` once they're done.

## Scope

See [[ren-scope]]. The install and its repo grants are **org-level** — keyed to the caller's org regardless of any `--scope user` flag — but the project that mounts the repo must live in a user-private pod (see Runtime behavior).

## Build via Ren CLI

```
ren github status                      # { hasInstallation, hasUserCredential, installations[] }
ren github install --output json       # → { url } — user opens it, picks repos, installs the App
ren github repos  --output json        # live list of { fullName } the installation can reach
ren github connect --output json       # fallback: re-link personal OAuth if a bind says "account not linked". Skip during onbaording.
ren github uninstall                   # disconnect the org's installation
```

Then bind a repo to a project — `gitRepo` is nested, so it goes through `--body` (see [[ren-project-dev]]):

```
ren projects update prj_… --scope user \
  --body '{ "gitRepo": { "url": "https://github.com/owner/repo", "baseBranch": "main", "mountPath": "/repo" } }'
```

`url` is the only required field; `baseBranch` and `mountPath` are optional. Pick the `url` from a `github repos` `fullName` (`https://github.com/<fullName>`).

## Build via Ren MCP

`{ path, query, body }` envelope:

```
mcp__ren__github_status     { }
mcp__ren__github_install    { }                                    # → { url }
mcp__ren__github_repos      { }                                    # → [{ fullName }]
mcp__ren__github_connect    { }                                    # → { url } (fallback)
mcp__ren__github_uninstall  { }
mcp__ren__project_update    { "query": { "scope": "user" }, "path": { "id": "prj_…" },
                              "body": { "gitRepo": { "url": "https://github.com/owner/repo" } } }
```

## Gotchas

- **Selected-repos installs.** If the user installed against specific repos (not "all"), a repo you don't see in `github repos` won't bind — they re-run `github install` to add it.
- **`status` is the source of truth.** After the browser flow there's nothing to poll — re-read `github status` (`hasInstallation` / `hasUserCredential`) before binding.

## Next steps

- **Bind the repo to a private-pod project** and open a session — the working tree mounts at `mountPath`. See [[ren-project-dev]].
- **Wire Slack** if the user also wants channel-driven triggers. See [[ren-slack]].
