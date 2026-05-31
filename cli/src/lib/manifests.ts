import { existsSync } from "node:fs"
import semver from "semver"
import {
  ClaudePluginManifest,
  CodexPluginManifest,
  MarketplaceManifest,
  SkillsShManifest,
} from "@renai-labs/registry-schemas"
import { PATHS } from "./paths"
import { readJson, writeJson } from "./json"

export async function readClaudeManifest(): Promise<ClaudePluginManifest> {
  return ClaudePluginManifest.parse(await readJson(PATHS.claudePluginJson))
}

export async function writeClaudeManifest(m: ClaudePluginManifest): Promise<void> {
  // Parse-on-write normalizes key order to the schema's declaration order so
  // the on-disk file is deterministic regardless of where keys sat originally.
  await writeJson(PATHS.claudePluginJson, ClaudePluginManifest.parse(m))
}

export async function readCodexManifest(): Promise<CodexPluginManifest> {
  return CodexPluginManifest.parse(await readJson(PATHS.codexPluginJson))
}

export async function writeCodexManifest(m: CodexPluginManifest): Promise<void> {
  await writeJson(PATHS.codexPluginJson, CodexPluginManifest.parse(m))
}

// plugin version bump rules: patch = skill version changed, minor = skill set changed, major = explicit marker
export type PluginBumpInput = {
  prior: Map<string, string>
  current: Map<string, string>
  priorVersion: string
  forceMajor: boolean
  firstBuild: boolean
}

export function decidePluginBump(input: PluginBumpInput): { next: string; reason: string } {
  const { prior, current, priorVersion, forceMajor, firstBuild } = input

  if (forceMajor) {
    const next = semver.inc(priorVersion, "major") ?? priorVersion
    return { next, reason: "explicit --plugin-major" }
  }

  if (firstBuild) return { next: priorVersion, reason: "first build (bootstrap)" } // no prior baseline to compare

  const added = [...current.keys()].filter((s) => !prior.has(s))
  const removed = [...prior.keys()].filter((s) => !current.has(s))
  if (added.length || removed.length) {
    const next = semver.inc(priorVersion, "minor") ?? priorVersion
    return { next, reason: `skill set changed: +${added.length} -${removed.length}` }
  }

  const changed = [...current.entries()].filter(([slug, v]) => prior.get(slug) !== v)
  if (changed.length) {
    const next = semver.inc(priorVersion, "patch") ?? priorVersion
    return { next, reason: `${changed.length} skill version(s) changed` }
  }

  return { next: priorVersion, reason: "no change" }
}

export async function readSkillsShManifest(): Promise<SkillsShManifest> {
  return SkillsShManifest.parse(await readJson(PATHS.skillsShJson))
}

export async function writeSkillsShManifest(m: SkillsShManifest): Promise<void> {
  await writeJson(PATHS.skillsShJson, SkillsShManifest.parse(m))
}

// CLI never auto-adds to skills.sh.json — only prunes deleted slugs; adding is a human curation call
export function reconcileSkillsShManifest(
  manifest: SkillsShManifest,
  currentSlugs: readonly string[],
): SkillsShManifest {
  const allCurrent = new Set(currentSlugs)
  const groupings = manifest.groupings.map((g) => ({
    ...g,
    skills: g.skills.filter((s) => allCurrent.has(s)),
  }))
  return { ...manifest, groupings }
}

export function bundledSlugs(manifest: SkillsShManifest): string[] {
  const seen = new Set<string>()
  for (const g of manifest.groupings) {
    for (const s of g.skills) seen.add(s)
  }
  return [...seen]
}

// marketplace manifests are pointer-only (no version field); validated on read so bad shape fails build, not distribution
export async function readClaudeMarketplace(): Promise<MarketplaceManifest> {
  return MarketplaceManifest.parse(await readJson(PATHS.claudeMarketplaceJson))
}

export async function readCodexMarketplace(): Promise<MarketplaceManifest> {
  return MarketplaceManifest.parse(await readJson(PATHS.codexMarketplaceJson))
}

export function ensureMarketplaceFilesExist(): { missing: string[] } {
  const missing = [PATHS.claudeMarketplaceJson, PATHS.codexMarketplaceJson].filter((p) => !existsSync(p))
  return { missing }
}
