import { join } from "node:path"
import type { Bump, SkillEntry, SkillVersionEntry } from "@renai-labs/registry-schemas"
import { hashTree } from "@/lib/hash"
import { parseSkill } from "@/lib/frontmatter"
import { PATHS } from "@/lib/paths"
import {
  bumpVersion,
  discoverSkillSlugs,
  findVersion,
  loadSkillsRegistry,
  saveSkillsRegistry,
} from "@/lib/snapshot"
import { log } from "@/lib/log"

export type ReleaseOptions = {
  slugs?: string[] // undefined or empty → all skills with drift / new skills
  bump: Bump
  yes: boolean
}

export type ReleaseResult = {
  released: { slug: string; from: string | null; to: string }[]
  skipped: { slug: string; reason: string }[]
}

const INITIAL_VERSION_FOR_BUMP: Record<Bump, string> = {
  patch: "0.0.1",
  minor: "0.1.0",
  major: "1.0.0",
}

export async function release(opts: ReleaseOptions): Promise<ReleaseResult> {
  const allSlugs = await discoverSkillSlugs()
  const candidates = opts.slugs?.length ? opts.slugs : allSlugs

  for (const s of candidates) {
    if (!allSlugs.includes(s)) {
      throw new Error(`release: unknown skill \`${s}\` (no data/skills/${s}/ directory)`)
    }
  }

  const entries = await loadSkillsRegistry()
  const bySlug = new Map(entries.map((e) => [e.slug, e]))

  const released: ReleaseResult["released"] = []
  const skipped: ReleaseResult["skipped"] = []

  for (const slug of candidates) {
    const parsed = await parseSkill(slug)
    const dir = join(PATHS.dataSkills, slug)
    const sourceHash = await hashTree(dir)
    const existing = bySlug.get(slug)

    if (existing && existing.contentHash === sourceHash) {
      skipped.push({ slug, reason: "no content change since last release" })
      continue
    }

    const nextVersion = existing
      ? bumpVersion(existing.currentVersion, opts.bump)
      : INITIAL_VERSION_FOR_BUMP[opts.bump]

    if (existing && findVersion(existing, nextVersion)) {
      throw new Error(`release ${slug}: target version ${nextVersion} already in versions[] — pick a different bump`)
    }

    const newVersionEntry: SkillVersionEntry = {
      version: nextVersion,
      gitRef: null,
      publishedAt: null,
      contentHash: sourceHash,
    }

    // Descriptive fields are re-derived from frontmatter; websiteMetadata is hand-curated, so it carries forward.
    const next: SkillEntry = {
      slug,
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      license: parsed.frontmatter.license ?? null,
      metadata: parsed.frontmatter.metadata ?? null,
      ...(existing?.websiteMetadata != null ? { websiteMetadata: existing.websiteMetadata } : {}),
      currentVersion: nextVersion,
      contentHash: sourceHash,
      versions: existing ? [...existing.versions, newVersionEntry] : [newVersionEntry],
    }

    bySlug.set(slug, next)
    released.push({ slug, from: existing?.currentVersion ?? null, to: nextVersion })
  }

  if (released.length) {
    await saveSkillsRegistry([...bySlug.values()])
  }

  return { released, skipped }
}

export async function runReleaseCommand(slugs: string[], opts: { bump: Bump; yes: boolean }): Promise<void> {
  log.header("release")
  const result = await release({ slugs, bump: opts.bump, yes: opts.yes })

  for (const r of result.released) {
    log.ok(`${r.slug}: ${r.from ?? "(initial)"} → ${r.to}`)
  }
  for (const s of result.skipped) {
    log.step(`${s.slug}: ${s.reason}`)
  }
  if (!result.released.length) {
    log.info("nothing to release")
  }
}
