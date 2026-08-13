# Placement

## The ladder

Set with `--visibility` on create (default `org`). There is no `--scope` flag; reads are a union of
your private rows, org rows and the published registry, and `--visibility` on a list is only a
filter. `search` uses `--sources user org registry` instead.

| Rung        | Means                      | Use when                                                              |
| ----------- | -------------------------- | --------------------------------------------------------------------- |
| `private`   | just this person           | default for personal work                                             |
| `org`       | everyone in the company    | company-wide work, or you are in a shared pod and it is the only rung |
| `pod`       | that pod's members         | accepted by the API, but real for **vaults** only                     |
| `published` | copyable from the registry | conferred by publishing, never chosen at create                       |

`promote` moves private → org in place, cascading through dependencies. There is no demotion.

**The team-sized middle is a pod, not a visibility.** _"My team needs this, the company doesn't"_ is
answered by building in the shared pod: its members are who can reach its projects, sandbox and
credentials. Vaults are the one thing genuinely owned by a pod
(`references/credentials.md`). `--visibility pod` on anything else is accepted and then stored as an
org row, so don't pass it.

## References flow narrower → broader only

A private skill can attach to a private project. An **org-visible** project cannot reference a
private skill: it fails with a scope violation, and the fix is to promote the dependency or keep the
project private. A published thing can depend only on published things.

Say it as a consequence: _"if I keep this just for you, the team's project can't use it — which do
you want?"_

## The ceiling

A property of the pod you run in, not of the kind of turn:

| Running in                         | Can create          |
| ---------------------------------- | ------------------- |
| The user's private pod (their DM)  | private **and** org |
| A shared pod                       | org only            |

Cron and channel turns inherit their pod's ceiling and are always attributed to a real person. A
private create from a shared pod fails with:

```
visibility 'private' requires a user-attributed request — use a user token, or create it as 'org'
```

Never relay that. Never silently create it as org instead — that is a privacy leak.

## The redirect

1. **Name it as a place, not a permission.** _"This belongs in your own workspace — built here,
   everyone in this pod gets it."_
2. **Offer the alternative right away.** _"…or I build it here for the whole team."_ The user
   chooses.
3. **Hand the exact destination.** You can see their private pod in the topology even though you
   can't act in it — give the name and link.
4. **Carry the work across.** Write the plan to a file store both pods reach and reference it, so
   they resume instead of being re-interviewed.

Only the blocked direction needs a redirect. Work that belongs to the team gets built where you are —
over-redirecting strands it with one person.
