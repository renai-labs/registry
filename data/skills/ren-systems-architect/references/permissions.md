# Permissions

## Contents

- [What permissions are](#what-permissions-are)
- [The shape](#the-shape)
- [Tool keys](#tool-keys)
- [Setting them](#setting-them)
- [Recipes](#recipes)
- [Gotchas](#gotchas)

## What permissions are

A project's `permission` config decides what its tools may do without asking: run, refuse, or stop
and ask the user first. It is the answer to "make this read-only", "don't let it post without me",
"the team can look but not touch" — an outcome about **this project**, set once, in force on every
session and every trigger fire.

Permissions live on the project. There is no other place to set them, and no per-person variant: a
project is the unit of trust, so a stricter posture for one group of people is a separate project.

## The shape

Three actions, and nothing else:

| Action  | Meaning                                                            |
| ------- | ------------------------------------------------------------------ |
| `allow` | runs silently                                                      |
| `ask`   | stops and asks the user, every time, before running                |
| `deny`  | refused outright; the tool call fails                              |

A rule is either an action applied to a whole tool, or a map of glob patterns to actions:

```jsonc
{
  "permission": {
    "webfetch": "deny",                             // whole tool
    "bash": { "*": "allow", "rm *": "deny" },       // per pattern
    "posthog_*": "deny"                             // an MCP's tools
  }
}
```

`ask` is the honest default for anything that leaves a mark and is not obviously wanted — sending,
posting, publishing, paying, deleting. Prefer it to `deny` when the user still wants the capability
but wants to be the one who decides.

## Tool keys

- **MCP tools** are `<mcp-slug>_<tool>`, so `slack_post_message` is one tool and `slack_*` is all of
  Slack's. Get exact names from the MCP's own tool list rather than guessing at them; a rule that
  matches nothing silently does nothing.
- **Built-ins** worth knowing: `bash`, `read`, `edit`, `write`, `webfetch`, `websearch`,
  `external_directory`, `skill`, `task`.
- Patterns are globs, matched against the tool name.

## Setting them

`permission` is nested, so it is `--body` only — there is no `--permission` flag.

```bash
ren projects get <prj_…> --output json                  # read what is there
# edit the permission object into project-update.json
ren projects update <prj_…> --body @project-update.json
ren projects get <prj_…> --output json                  # read it back and confirm
```

**Always read back.** The write returning cleanly means it validated, not that it says what you
meant. Confirm the keys you intended are present and spelled the way you expect.

## Recipes

**Read-only project.** Deny the mutating tools of each attached MCP by name, leaving the reads:

```jsonc
{ "permission": { "meta_create_*": "deny", "meta_update_*": "deny", "meta_delete_*": "deny" } }
```

**Ask before anything lands outside.** Keep the capability, move the decision to the user:

```jsonc
{ "permission": { "slack_post_message": "ask", "email_send": "ask" } }
```

**Lock one integration, keep the rest.** `"<slug>_*": "deny"` removes an MCP's whole surface without
detaching it, so the wiring survives and can be re-enabled by flipping one line.

## Gotchas

- **The write replaces the whole `permission` object.** Read the project first and pass the union, or
  rules that were there are dropped.
- **Do not lean on key order.** Storage does not preserve the order you wrote, so express intent in
  the patterns themselves — a specific rule and a broad one must not contradict each other and rely
  on which came first.
- **`*` is a baseline, not an override.** A bare `"*": "deny"` sets the floor; specific patterns
  still decide their own tools.
- **A rule for a tool that is not attached does nothing.** Denying an MCP the project does not have
  is not protection; check what is actually attached first.
- **Denying a tool does not remove it from the roster** — the model still sees it and may try. Say so
  in project instructions when the refusal would otherwise be confusing.
