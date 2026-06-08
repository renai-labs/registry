import { join, resolve } from "node:path"

// Tests rebuild PATHS against a fixture directory by setting this env var
// before importing the CLI. Production callers leave it unset.
export const REPO_ROOT = process.env.RENREGISTRY_REPO_ROOT ?? resolve(import.meta.dir, "../../..")

// Skills are the only domain with per-entry directories (SKILL.md + assets).
// Agents / MCPs / tags are flat — their JSON file IS the source.

export const PATHS = {
  data: join(REPO_ROOT, "data"),
  dataSkills: join(REPO_ROOT, "data", "skills"),
  skillsJson: join(REPO_ROOT, "data", "skills.json"),
  agentsJson: join(REPO_ROOT, "data", "agents.json"),
  mcpsJson: join(REPO_ROOT, "data", "mcp_servers.json"),
  tagsJson: join(REPO_ROOT, "data", "tags.json"),
  rootSkillsMirror: join(REPO_ROOT, "skills"),
  pluginSkillsMirror: join(REPO_ROOT, "plugins", "ren", "skills"),
  claudePluginJson: join(REPO_ROOT, ".claude-plugin", "plugin.json"),
  codexPluginJson: join(REPO_ROOT, ".codex-plugin", "plugin.json"),
  claudeMarketplaceJson: join(REPO_ROOT, ".claude-plugin", "marketplace.json"),
  codexMarketplaceJson: join(REPO_ROOT, ".agents", "plugins", "marketplace.json"),
  skillsShJson: join(REPO_ROOT, "skills.sh.json"),
  pluginMajorMarker: join(REPO_ROOT, "data", ".plugin-major-bump"),
} as const
