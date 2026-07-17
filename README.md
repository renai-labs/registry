# renai-labs/registry — generated mirror

> ⚠️ **This repository is generated. Do not edit it by hand — changes here are overwritten on the next mirror run.**

Ren's first-party skills, the `ren` agent, and the MCP catalog are authored in the Ren
monorepo ([`renai-labs/ren`](https://github.com/renai-labs/ren), the `registry/` package)
and published to the Ren platform, which is the source of truth. This repository is
rendered from the platform database on every publish and on a periodic sweep, and remains
the public delivery surface for plugins and the CLI.

What lives here (all generated):

- `data/skills/<slug>/` — skill content the CLI and the Claude/Codex plugins read
- `data/manifest.json` — plugin version + skill-version map
- `.claude-plugin/`, `.codex-plugin/`, `plugins/ren/` — plugin distribution
- `skills.sh.json` — curated skill grouping

To change a first-party skill, agent, or MCP, edit it in `renai-labs/ren` and let CI
publish and mirror. Community and user content is managed on the Ren platform (API/UI),
not here.
