import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import semver from "semver"
import { SkillsRegistry, type SkillEntry } from "@renai-labs/registry-schemas"
import { hashFromEntries, hashTree, isIgnoredRelPath } from "./hash"
import { gitCatBlob, gitLsTree, gitMergeBase, gitRefExists, gitShowFile } from "./git"
import {
  clearPluginMajorMarker,
  loadAgentsRegistry,
  loadMcpsRegistry,
  loadSkillsRegistry,
  loadTagsRegistry,
  pluginMajorMarkerExists,
  saveAgentsRegistry,
  saveMcpsRegistry,
  saveSkillsRegistry,
  saveTagsRegistry,
  discoverSkillSlugs,
} from "./snapshot"
import { parseSkill } from "./frontmatter"
import { PATHS } from "./paths"
import {
  ClaudePluginManifest,
  CodexPluginManifest,
  SkillsShManifest,
} from "@renai-labs/registry-schemas"
import {
  bundledSlugs,
  decidePluginBump,
  ensureMarketplaceFilesExist,
  readClaudeManifest,
  readCodexManifest,
  readSkillsShManifest,
  reconcileSkillsShManifest,
  writeClaudeManifest,
  writeCodexManifest,
  writeSkillsShManifest,
} from "./manifests"
import { mirrorSkill, mirrorSkillToDir, pruneMirrors } from "./mirror"
import { writeJson } from "./json"
import { log } from "./log"

export type DriftReport = {
  drifted: { slug: string; sourceHash: string; snapshotHash: string }[]
  unreleased: string[] // skill dir on disk but no snapshot entry
  orphaned: string[] // snapshot entry but no skill dir
  unbundled: string[] // listed in skills.sh.json but no skill dir / no snapshot
}

export async function detectDrift(): Promise<DriftReport> {
  const sourceSlugs = await discoverSkillSlugs()
  const entries = await loadSkillsRegistry()
  const bySlug = new Map(entries.map((e) => [e.slug, e]))
  const sourceSet = new Set(sourceSlugs)

  const drifted: DriftReport["drifted"] = []
  const unreleased: string[] = []
  for (const slug of sourceSlugs) {
    const sourceHash = await hashTree(join(PATHS.dataSkills, slug))
    const entry = bySlug.get(slug)
    if (!entry) {
      unreleased.push(slug)
      continue
    }
    if (entry.contentHash !== sourceHash) {
      drifted.push({ slug, sourceHash, snapshotHash: entry.contentHash })
    }
  }
  const orphaned = entries.filter((e) => !sourceSet.has(e.slug)).map((e) => e.slug)

  // Catch the "skills.sh.json names a slug that doesn't exist" case so the
  // curated bundle list can't quietly drift out of sync with reality.
  const skillsSh = await readSkillsShManifest()
  const bundled = bundledSlugs(skillsSh)
  const unbundled = bundled.filter((s) => !sourceSet.has(s))

  return { drifted, unreleased, orphaned, unbundled }
}

export function formatDriftProblems(drift: DriftReport): string[] {
  const problems: string[] = []
  for (const d of drift.drifted)
    problems.push(`drift: ${d.slug} — source content changed without a release; run \`ren-registry release ${d.slug}\``)
  for (const s of drift.unreleased) problems.push(`unreleased: ${s} — new skill; run \`ren-registry release ${s}\``)
  for (const s of drift.orphaned)
    problems.push(`orphaned: ${s} — snapshot entry has no matching data/skills/ directory`)
  for (const s of drift.unbundled)
    problems.push(`bundled-missing: ${s} — listed in skills.sh.json but no data/skills/${s}/ directory`)
  return problems
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`
}

// The contentHash drift check can't see a hand-edit to skills.json metadata (skills.json isn't in
// the hash tree), so re-derive the published fields from frontmatter and flag any divergence.
export async function detectDerivationIssues(entries: SkillEntry[]): Promise<string[]> {
  const problems: string[] = []
  const sourceSlugs = new Set(await discoverSkillSlugs())
  for (const entry of entries) {
    if (!sourceSlugs.has(entry.slug)) continue
    const sourceHash = await hashTree(join(PATHS.dataSkills, entry.slug))
    // Out-of-sync entries are already reported by the drift check with a release hint; skip them here.
    if (entry.contentHash !== sourceHash) continue

    const { frontmatter: fm } = await parseSkill(entry.slug)
    const expected = {
      name: fm.name,
      description: fm.description,
      license: fm.license ?? null,
      metadata: fm.metadata ?? null,
    }
    const actual = {
      name: entry.name,
      description: entry.description,
      license: entry.license ?? null,
      metadata: entry.metadata ?? null,
    }
    if (stableStringify(expected) !== stableStringify(actual)) {
      problems.push(
        `derivation: ${entry.slug} — skills.json fields don't match SKILL.md frontmatter; ` +
          `skills.json is generated from frontmatter, run \`ren-registry release ${entry.slug}\``,
      )
    }
  }
  return problems
}

// An entry with `gitRef != null` is "frozen" — published and immutable.
// The snapshot may grow (new entries appended) but a frozen entry MUST NOT
// disappear or have its identity fields (gitRef, contentHash) mutate.
// Base ref priority: RENREGISTRY_BASE_REF env → merge-base(HEAD, origin/main) → HEAD~1.

export type FrozenDiffIssue = {
  slug: string
  version: string
  kind: "removed" | "gitref-changed" | "hash-changed"
  detail: string
}

export type PrBaseDiffOptions = {
  baseRef?: string
}

function resolveBaseRef(opt: string | undefined): string | null {
  if (opt) return opt
  const env = process.env.RENREGISTRY_BASE_REF
  if (env) return env
  const mb = gitMergeBase("HEAD", "origin/main")
  if (mb) return mb
  return "HEAD~1" // local fallback; safe to skip if HEAD~1 doesn't exist (initial commit)
}

export async function detectPrBaseDiffIssues(
  current: SkillEntry[],
  opts: PrBaseDiffOptions = {},
): Promise<{ issues: FrozenDiffIssue[]; usedBaseRef: string | null }> {
  const baseRef = resolveBaseRef(opts.baseRef)
  if (!baseRef) return { issues: [], usedBaseRef: null }

  const baseRaw = gitShowFile(baseRef, "data/skills.json")
  if (baseRaw === null) return { issues: [], usedBaseRef: null }
  let baseParsed: SkillEntry[]
  try {
    baseParsed = SkillsRegistry.parse(JSON.parse(baseRaw))
  } catch {
    // Base predates this file or has a different shape — nothing to compare.
    return { issues: [], usedBaseRef: null }
  }

  const issues: FrozenDiffIssue[] = []
  const currentBySlug = new Map(current.map((e) => [e.slug, e]))
  for (const baseEntry of baseParsed) {
    const cur = currentBySlug.get(baseEntry.slug)
    if (!cur) {
      for (const v of baseEntry.versions) {
        if (v.gitRef !== null) {
          issues.push({
            slug: baseEntry.slug,
            version: v.version,
            kind: "removed",
            detail: `present in base ${baseRef.slice(0, 7)} but slug removed in HEAD`,
          })
        }
      }
      continue
    }
    const curVersions = new Map(cur.versions.map((v) => [v.version, v]))
    for (const baseV of baseEntry.versions) {
      if (baseV.gitRef === null) continue
      const curV = curVersions.get(baseV.version)
      if (!curV) {
        // Removing an intermediate frozen version (not currentVersion) is allowed
        // as a data-hygiene fix — e.g. a version whose contentHash was stamped at a
        // transient working-tree state. Only flag full-slug removals (handled above).
        if (baseV.version !== baseEntry.currentVersion) continue
        issues.push({
          slug: baseEntry.slug,
          version: baseV.version,
          kind: "removed",
          detail: `frozen entry present at base ${baseRef.slice(0, 7)} is missing in HEAD`,
        })
        continue
      }
      if (curV.gitRef !== baseV.gitRef) {
        issues.push({
          slug: baseEntry.slug,
          version: baseV.version,
          kind: "gitref-changed",
          detail: `gitRef ${baseV.gitRef.slice(0, 7)} → ${(curV.gitRef ?? "null").slice(0, 7)}`,
        })
      }
      if (curV.contentHash !== baseV.contentHash) {
        issues.push({
          slug: baseEntry.slug,
          version: baseV.version,
          kind: "hash-changed",
          detail: `contentHash ${baseV.contentHash.slice(0, 12)}… → ${curV.contentHash.slice(0, 12)}…`,
        })
      }
    }
  }
  return { issues, usedBaseRef: baseRef }
}

// Skipped (with a warning) when the git ref isn't reachable (shallow clone) —
// report instead of fail so the check stays usable in CI without fetch-depth 0.
export type FrozenIntegrityIssue = {
  slug: string
  version: string
  kind: "ref-missing" | "hash-mismatch"
  detail: string
}

export async function detectFrozenIntegrityIssues(entries: SkillEntry[]): Promise<FrozenIntegrityIssue[]> {
  const issues: FrozenIntegrityIssue[] = []
  for (const entry of entries) {
    for (const v of entry.versions) {
      if (v.gitRef === null) continue
      if (!gitRefExists(v.gitRef)) {
        issues.push({
          slug: entry.slug,
          version: v.version,
          kind: "ref-missing",
          detail: `gitRef ${v.gitRef.slice(0, 7)} not reachable (shallow clone? fetch --unshallow to verify)`,
        })
        continue
      }
      const treePath = `data/skills/${entry.slug}`
      let rows: { relPath: string; oid: string }[]
      try {
        rows = gitLsTree(v.gitRef, treePath)
      } catch (e) {
        issues.push({
          slug: entry.slug,
          version: v.version,
          kind: "ref-missing",
          detail: `data/skills/${entry.slug} not present at gitRef ${v.gitRef.slice(0, 7)}: ${(e as Error).message}`,
        })
        continue
      }
      const filtered = rows.filter((r) => !isIgnoredRelPath(r.relPath))
      const blobs = filtered.map((r) => ({ relPath: r.relPath, buf: gitCatBlob(r.oid) }))
      const recomputed = hashFromEntries(blobs)
      if (recomputed !== v.contentHash) {
        issues.push({
          slug: entry.slug,
          version: v.version,
          kind: "hash-mismatch",
          detail: `recorded contentHash ${v.contentHash.slice(0, 12)}… ≠ recomputed ${recomputed.slice(0, 12)}… at gitRef ${v.gitRef.slice(0, 7)}`,
        })
      }
    }
  }
  return issues
}

export function detectSelfConsistencyIssues(entries: SkillEntry[]): string[] {
  const problems: string[] = []
  for (const entry of entries) {
    const { slug, versions, currentVersion, contentHash } = entry

    const seen = new Set<string>()
    for (const v of versions) {
      if (seen.has(v.version)) {
        problems.push(`self-consistency: ${slug} — duplicate version ${v.version} in versions[]`)
      }
      seen.add(v.version)
    }

    const sortedVersions = [...versions].sort((a, b) => semver.compare(a.version, b.version))
    const isSorted = versions.every((v, i) => v.version === sortedVersions[i]!.version)
    if (!isSorted) {
      problems.push(`self-consistency: ${slug} — versions[] not sorted ascending by semver`)
    }

    const highest = sortedVersions[sortedVersions.length - 1]!
    if (highest.version !== currentVersion) {
      problems.push(
        `self-consistency: ${slug} — currentVersion ${currentVersion} is not the highest in versions[] (max: ${highest.version})`,
      )
    }
    const currentEntry = versions.find((v) => v.version === currentVersion)
    if (currentEntry && currentEntry.contentHash !== contentHash) {
      problems.push(
        `self-consistency: ${slug} — currentVersion.contentHash differs from versions[${currentVersion}].contentHash`,
      )
    }
  }
  return problems
}

export type BuildOptions = {
  // When set, all generated artifacts land under this scratch dir instead of
  // the real repo paths. Used by `check` for the scratch-build diff.
  scratch?: {
    pluginSkillsMirror: string
    rootSkillsMirror: string
    claudePluginJson: string
    codexPluginJson: string
    skillsShJson: string
  }
  // Skip drift check (used internally — release mutates the snapshot then
  // calls build, and the new contentHash hasn't been persisted yet).
  skipDriftCheck?: boolean
}

export type BuildResult = {
  skillsCount: number
  pluginVersion: { previous: string; next: string; reason: string }
  mirroredSlugs: string[]
  prunedMirrorPaths: string[]
}

export class BuildError extends Error {
  constructor(public readonly problems: string[]) {
    super(`build refused (${problems.length} issue${problems.length === 1 ? "" : "s"}):\n  - ${problems.join("\n  - ")}`)
    this.name = "BuildError"
  }
}

// Plugin bump baseline = the committed state at the base ref (merge-base with
// main, falling back to HEAD~1) — the same baseline the frozen-integrity check
// uses, so it's reproducible in CI and needs no local cache file.
type BumpBaseline = { priorSkills: Map<string, string>; priorVersion: string; firstBuild: boolean }

function readBumpBaseline(fallbackVersion: string): BumpBaseline {
  const bootstrap: BumpBaseline = { priorSkills: new Map(), priorVersion: fallbackVersion, firstBuild: true }
  const baseRef = resolveBaseRef(undefined)
  if (!baseRef) return bootstrap

  const skillsRaw = gitShowFile(baseRef, "data/skills.json")
  if (skillsRaw === null) return bootstrap
  let baseSkills: SkillEntry[]
  try {
    baseSkills = SkillsRegistry.parse(JSON.parse(skillsRaw))
  } catch {
    return bootstrap
  }

  const shRaw = gitShowFile(baseRef, "skills.sh.json")
  let baseBundled: Set<string>
  try {
    baseBundled = shRaw
      ? new Set(bundledSlugs(SkillsShManifest.parse(JSON.parse(shRaw))))
      : new Set(baseSkills.map((s) => s.slug))
  } catch {
    baseBundled = new Set(baseSkills.map((s) => s.slug))
  }
  const priorSkills = new Map(
    baseSkills.filter((s) => baseBundled.has(s.slug)).map((s) => [s.slug, s.currentVersion]),
  )

  let priorVersion = fallbackVersion
  const manifestRaw = gitShowFile(baseRef, "plugins/ren/.claude-plugin/plugin.json")
  if (manifestRaw !== null) {
    try {
      priorVersion = ClaudePluginManifest.parse(JSON.parse(manifestRaw)).version ?? fallbackVersion
    } catch {
      priorVersion = fallbackVersion
    }
  }
  return { priorSkills, priorVersion, firstBuild: false }
}

export async function build(opts: BuildOptions = {}): Promise<BuildResult> {
  if (!opts.skipDriftCheck) {
    const problems: string[] = []

    // Self-consistency runs first so structurally-invalid snapshots fail
    // before we waste time hashing trees that won't match anything anyway.
    const snapshot = await loadSkillsRegistry()
    problems.push(...detectSelfConsistencyIssues(snapshot))

    problems.push(...formatDriftProblems(await detectDrift()))
    if (problems.length) throw new BuildError(problems)
  }

  const marketplaceCheck = ensureMarketplaceFilesExist()
  if (marketplaceCheck.missing.length) {
    throw new BuildError(marketplaceCheck.missing.map((p) => `marketplace file missing: ${p}`))
  }

  const skills = await loadSkillsRegistry()

  // Frontmatter must still parse — guards against deletions or renames that
  // happened between release and build.
  for (const slug of skills.map((s) => s.slug)) {
    await parseSkill(slug)
  }

  const claudeManifest = await readClaudeManifest()
  const codexManifest = await readCodexManifest()
  const priorVersion = claudeManifest.version ?? codexManifest.version
  const forceMajor = pluginMajorMarkerExists()

  // bundled = curated subset for plugin distribution; full skills.json goes to the backend payload
  const skillsSh = reconcileSkillsShManifest(await readSkillsShManifest(), skills.map((s) => s.slug))
  const bundled = new Set(bundledSlugs(skillsSh))
  const bundledEntries = skills.filter((s) => bundled.has(s.slug))

  const baseline = readBumpBaseline(priorVersion)
  const bump = decidePluginBump({
    prior: baseline.priorSkills,
    current: new Map(bundledEntries.map((s) => [s.slug, s.currentVersion])),
    priorVersion: baseline.priorVersion,
    forceMajor,
    firstBuild: baseline.firstBuild,
  })

  const pluginTarget = opts.scratch?.pluginSkillsMirror ?? PATHS.pluginSkillsMirror
  const rootTarget = opts.scratch?.rootSkillsMirror ?? PATHS.rootSkillsMirror

  if (opts.scratch) {
    await mkdir(pluginTarget, { recursive: true })
    await mkdir(rootTarget, { recursive: true })
    for (const entry of bundledEntries) {
      await mirrorSkillToDir(entry, pluginTarget)
      await mirrorSkillToDir(entry, rootTarget)
    }
  } else {
    for (const entry of bundledEntries) await mirrorSkill(entry)
  }

  const prunedMirrorPaths = opts.scratch ? [] : await pruneMirrors(bundledEntries.map((s) => s.slug))

  const nextClaude = { ...claudeManifest, version: bump.next }
  const nextCodex = { ...codexManifest, version: bump.next }
  if (opts.scratch) {
    await mkdir(dirname(opts.scratch.claudePluginJson), { recursive: true })
    await mkdir(dirname(opts.scratch.codexPluginJson), { recursive: true })
    await writeJson(opts.scratch.claudePluginJson, ClaudePluginManifest.parse(nextClaude))
    await writeJson(opts.scratch.codexPluginJson, CodexPluginManifest.parse(nextCodex))
  } else {
    await writeClaudeManifest(nextClaude)
    await writeCodexManifest(nextCodex)
  }

  if (opts.scratch) { // skills.sh: pruned only — no auto-add
    await mkdir(dirname(opts.scratch.skillsShJson), { recursive: true })
    await writeJson(opts.scratch.skillsShJson, SkillsShManifest.parse(skillsSh))
  } else {
    await writeSkillsShManifest(skillsSh)
  }

  if (!opts.scratch) {
    await clearPluginMajorMarker()

    await saveSkillsRegistry(skills)
    await saveAgentsRegistry(await loadAgentsRegistry())
    await saveMcpsRegistry(await loadMcpsRegistry())
    await saveTagsRegistry(await loadTagsRegistry())

    log.ok(
      `mirrored ${bundledEntries.length}/${skills.length} skill(s); ` +
        `plugin v${priorVersion} → v${bump.next} (${bump.reason})`,
    )
    if (prunedMirrorPaths.length) log.step(`pruned ${prunedMirrorPaths.length} stale mirror dir(s)`)
  }

  return {
    skillsCount: bundledEntries.length,
    pluginVersion: { previous: priorVersion, next: bump.next, reason: bump.reason },
    mirroredSlugs: bundledEntries.map((s) => s.slug),
    prunedMirrorPaths,
  }
}
