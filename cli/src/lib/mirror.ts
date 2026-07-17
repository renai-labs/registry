import { symlink, rm, readlink, lstat, mkdir, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, relative } from "node:path"
import { PATHS } from "./paths"

// A mirror is a real directory of per-skill symlinks into data/skills/ — single
// source of truth (no copies), but only the curated/bundled slugs are linked so
// plugin consumers see the shipped subset, not the full internal catalog.
const MIRROR_TARGETS = [PATHS.pluginSkillsMirror, PATHS.rootSkillsMirror] as const

function expectedSkillTarget(mirrorRoot: string, slug: string): string {
  return relative(mirrorRoot, join(PATHS.dataSkills, slug))
}

// Replace a pre-refactor whole-dir symlink (mirrorRoot itself a symlink) with a
// real directory we can populate per-skill.
async function ensureMirrorDir(mirrorRoot: string): Promise<void> {
  try {
    const stat = await lstat(mirrorRoot)
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      await rm(mirrorRoot, { recursive: true, force: true })
    }
  } catch {
    // doesn't exist yet
  }
  await mkdir(mirrorRoot, { recursive: true })
}

async function ensureSkillSymlink(mirrorRoot: string, slug: string): Promise<void> {
  const linkPath = join(mirrorRoot, slug)
  const expected = expectedSkillTarget(mirrorRoot, slug)
  try {
    const stat = await lstat(linkPath)
    if (stat.isSymbolicLink() && (await readlink(linkPath)) === expected) return
    await rm(linkPath, { recursive: true, force: true })
  } catch {
    // doesn't exist yet
  }
  await symlink(expected, linkPath)
}

export async function createMirrorSymlinks(
  bundledSlugs: readonly string[],
  targets: readonly string[] = MIRROR_TARGETS,
): Promise<void> {
  for (const mirrorRoot of targets) {
    await ensureMirrorDir(mirrorRoot)
    for (const slug of bundledSlugs) await ensureSkillSymlink(mirrorRoot, slug)
  }
}

// Drops any per-skill link no longer in the bundled set (skill un-bundled or removed).
export async function pruneMirrors(bundledSlugs: readonly string[]): Promise<string[]> {
  const keep = new Set(bundledSlugs)
  const pruned: string[] = []
  for (const mirrorRoot of MIRROR_TARGETS) {
    if (!existsSync(mirrorRoot)) continue
    for (const name of await readdir(mirrorRoot)) {
      if (name.startsWith(".")) continue
      if (keep.has(name)) continue
      const full = join(mirrorRoot, name)
      await rm(full, { recursive: true, force: true })
      pruned.push(full)
    }
  }
  return pruned
}

export async function validateMirrorSymlinks(bundledSlugs: readonly string[]): Promise<string[]> {
  const problems: string[] = []
  const expected = new Set(bundledSlugs)
  for (const mirrorRoot of MIRROR_TARGETS) {
    let stat
    try {
      stat = await lstat(mirrorRoot)
    } catch {
      problems.push(`mirror missing: ${mirrorRoot}`)
      continue
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      problems.push(`mirror not a directory: ${mirrorRoot}`)
      continue
    }

    const present = (await readdir(mirrorRoot)).filter((n) => !n.startsWith("."))
    const presentSet = new Set(present)
    for (const slug of bundledSlugs) {
      const linkPath = join(mirrorRoot, slug)
      if (!presentSet.has(slug)) {
        problems.push(`mirror missing skill: ${linkPath}`)
        continue
      }
      const link = await lstat(linkPath)
      if (!link.isSymbolicLink()) {
        problems.push(`mirror entry not a symlink: ${linkPath}`)
        continue
      }
      const target = await readlink(linkPath)
      const want = expectedSkillTarget(mirrorRoot, slug)
      if (target !== want) {
        problems.push(`mirror symlink target mismatch: ${linkPath} → ${target} (expected ${want})`)
      }
    }
    for (const name of present) {
      if (!expected.has(name)) problems.push(`mirror has unbundled skill: ${join(mirrorRoot, name)}`)
    }
  }
  return problems
}
