#!/usr/bin/env bash
# PostToolUse hook: when an Edit/Write touches a SKILL.md under data/skills/,
# validate its frontmatter so malformed YAML (or a stray `version:`) is caught
# at edit time instead of in CI. Exit 2 feeds the error back to Claude.
set -euo pipefail

input="$(cat)"
file="$(printf '%s' "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')"

case "$file" in
  */data/skills/*/SKILL.md)
    repo_root="${file%%/data/skills/*}"
    if ! out="$(cd "$repo_root" && bun cli/src/index.ts validate 2>&1)"; then
      echo "SKILL.md frontmatter validation failed:" >&2
      echo "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0
