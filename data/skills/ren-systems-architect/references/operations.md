# Operations

How to actually mutate Ren. Judgment about *what* to build is `references/design-patterns.md`. Full
flags: `ren docs commands`; the MCP transport exposes the same operations as `mcp__ren__*` tools.

## Contents

- [Conventions](#conventions)
- [Pods and sandboxes](#pods-and-sandboxes)
- [Projects](#projects)
- [Sessions and hand-off](#sessions-and-hand-off)
- [Stores and files](#stores-and-files)
- [Pod databases](#pod-databases)
- [Cron triggers](#cron-triggers)
- [Artifacts](#artifacts)
- [Environments](#environments)
- [Models and instructions](#models-and-instructions)

## Conventions

- **No `--scope` flag.** Create with `--visibility private|org` (default `org`); reads return your
  private rows, org rows and published rows together. `search` filters with
  `--sources user org registry`.
- **Nested fields go through `--body`** — JSON string, `@file`, or `@-`. Anything longer than a line
  (prompts, JSON blobs) belongs in a file: inline JSON breaks on quotes, backticks and fences.
- `--output json` for anything you need to parse.

## Finding an integration

Before telling anyone a connection doesn't exist, search **both** surfaces — an integration arrives as
an MCP *or* as a skill that drives the API with a credential, and only one of them is called an MCP:

```bash
ren mcps search --query shopify --sources user org registry
ren skills list --query shopify          # private + org + published in one read
```

`ren topology get` is not this search: it shows what is attached in the visible setup, so an MCP or
skill that exists but is not attached to the project is invisible in it. Attaching an existing skill
to the project is a far smaller ask than building a custom MCP — check before authoring anything.

## Pods and sandboxes

```bash
ren pods list                              # private and shared pods you can see
ren pods get <pod_…>
ren pods create --name "Growth" --visibility org
ren pods members add <pod_…> --user-id <usr_…>      # members are pod-scoped, not project-scoped
ren pods update <pod_…> --instructions @pod-instructions.md
```

Sandbox readiness — check before handing back a session:

```bash
ren pods sandboxes status <pod_…> --output json
```

A discriminated union on `status`:

| `status`       | Meaning and what to do                                                            |
| -------------- | ----------------------------------------------------------------------------------- |
| `ready`        | live; proceed. Also returns `serverPassword` (HTTP-basic, username `opencode`)     |
| `provisioning` | in flight, with a `phase`; poll again without yielding to the user                 |
| `absent`       | run `ren pods sandboxes provision <pod_…>`, then poll. Provision is idempotent and resumes a paused box |
| `failed`       | carries `reason`. Surface it plainly and stop; do not retry on autopilot            |

`ren pods sandboxes teardown <pod_…>` destroys it; the next session provisions a fresh one.

## Projects

```bash
ren projects create --pod-id <pod_…> --name "Deploy watch" --visibility private
ren projects update <prj_…> --instructions @project-instructions.md
ren projects get <prj_…> --output json
# Write project-update.json with the existing gitRepos plus the new repository.
ren projects update <prj_…> --body @project-update.json
ren projects archive <prj_…>
```

`gitRepos`, `references` and `permission` are nested — `--body` only. Creating a project requires a
published Ren definition and injects it automatically, so every project is immediately runnable by
Ren. `gitRepos` is full-replace on update: read the project first, merge by repository URL and
pass the complete list, or existing bindings are removed.

`permission` decides what the project's tools may do — allow, ask, or deny, per tool or per glob.
It is how a read-only or approval-first posture is achieved, and it is full-replace like the rest:
`references/permissions.md`.

New and user-created capabilities attach to the project:

```bash
ren projects skills add <prj_…> --skill-id <skl_…>      # omit --skill-version-id to track latest
ren projects mcps add <prj_…> --mcp-id <mcp_…>
ren projects skills resolution <prj_…>                  # what actually resolved, with pin conflicts
ren projects file-stores add <prj_…> --file-store-id <fst_…>
ren projects memory-stores add <prj_…> --memory-store-id <mst_…>
```

Re-attaching something already attached is a conflict error, not an upsert — `… list` first.

## Sessions and hand-off

```bash
ren sessions create --pod-id <pod_…> --project-id <prj_…> --title "First run"
ren sessions create-status <job-id>
ren sessions list --project-id <prj_…>
ren sessions messages list <ses_…>
ren sessions url <ses_…>        # raw OpenCode sandbox URL + basic-auth password
ren sessions traces list <ses_…> --output json --fields core,io,observations,metrics,scores
ren replays share --body '{"sessionId":"<ses_…>"}'   # public scrub link to a run
```

The sandbox must be `ready` before a session loads. Hand users the Ren app link, not the raw sandbox
URL:

```
<base>/pods/<podId>/projects/<projectId>/sessions/<sessionId>
<base>/pods/<podId>/projects/<projectId>
<base>/pods/<podId>/vaults      where the user adds this pod's credentials
<base>/vaults                   the org's credentials
```

`<base>` is `${REN_APP_URL}` when a shell resolves it, otherwise `https://renai.build/app`. Never
emit a `localhost` link.

## Stores and files

```bash
ren memory-stores create --name "Team memory" --visibility org
ren file-stores files write-content <fst_…> --path notes.md --content @notes.md   # ≤5 MiB
ren file-stores files list <fst_…>
ren file-stores files presign-download <fst_…> --path notes.md
ren file-stores files delete <fst_…> --path notes.md
```

`memory-stores` takes the identical subcommands. For anything above 5 MiB (ceiling 50 MiB), use the
three-step upload — neither CLI nor MCP moves the bytes for you:

```bash
ren file-stores files start-upload <fst_…> --path data.csv --size 1234 --output json
# → { url, uploadId, expiresAt }
curl -X PUT --data-binary @data.csv "<url>"
ren file-stores files finalize-upload <fst_…> --path data.csv --upload-id <uploadId>
```

Until finalize runs, the file sits in staging: invisible to workspaces, absent from the file list,
and reaped after 24 hours.

## Pod databases

```bash
ren pod-databases create <pod_…> --name "Seen items"     # → /home/user/db/<slug>.db
ren pod-databases list <pod_…>
ren pod-databases archive <pod_…> <pdb_…>                # keeps the replicated bytes
```

Shared by every project in the pod. Query the file; never edit it by hand.

**Create the row first.** A SQLite file Ren writes bare into `/home/user/db/` replicates, but on
the next sandbox rebuild only rows from the manifest hydrate back — the bare file vanishes.

**Recreating an archived slug inherits its old data.** The replica is keyed by filename, so a new row
under an old slug reads back the old replica. A fresh ledger that needs to start clean must use a new
slug.

## Cron triggers

```bash
ren cron-triggers create <prj_…> \
  --schedule "0 9 * * 1" --timezone "Europe/London" \
  --input-message "Post last week's deploy failures to #deploys" \
  --is-enabled true
ren cron-triggers update <prj_…> <ctrg_…> --is-enabled false
ren cron-triggers list <prj_…>
```

`--schedule` is a 5-field cron expression. **Always pass `--timezone`** — unset means UTC. Update
takes the project id as well; it is the auth key, not a change field. Toggling `isEnabled` propagates
on the next manifest refresh.

Each fire opens a **fresh session** on the project with `inputMessage` as the first user turn. A
paused sandbox wakes on demand; a `failed` one blocks the fire.

## Artifacts

These run **only inside a Ren sandbox** and infer the pod from the sandbox token — no pod id, no
artifact id, slugs throughout. The building craft is the `ren-artifact` skill; when to reach for one
and how it stays fresh is `references/artifacts.md`.

```bash
ren artifacts scaffold <slug> --title "Weekly report" --template <ren-artifact dir>/assets/template.tar.gz
ren artifacts list                       # what this pod already has
ren artifacts sync <slug>                # push the built directory to storage
ren artifacts archive <slug>             # takes the URL offline, keeps the bytes
```

`bun run build` in the artifact directory after a code change, `bun run sync-data` after a data
change; both push when they finish. The returned URL is unauthenticated and stable across rebuilds.

## Environments

`ren environments create|update|get|list`, `ren environments builds start|list`. An environment is
the pod's networking and package set; attach it at pod create or update. Rebuild after changing
packages.

## Models and instructions

```bash
ren models list --output json          # live catalog with pricing
ren orgs update --instructions @org-instructions.md
```

Pod and project instructions are set with `ren pods update` / `ren projects update` above.

The three layers **accumulate rather than override**: a project runs with the org's and its pod's
instructions appended to its own. They are re-read before every model request, so unlike anything
said in conversation they cannot be summarised away and hold on every turn, in every session, and on
every trigger fire. That makes them the place for doctrine — the standing rules that must survive the
conversation. Put each fact at the widest layer where it is true (`references/design-patterns.md`),
and set them with `--instructions @file`: the flag replaces that layer's text, so read the current
value first when adding to it.
