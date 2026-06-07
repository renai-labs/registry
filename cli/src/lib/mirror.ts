import { symlink, rm, readlink, lstat, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { PATHS } from "./paths"

// mirrors are symlinks to data/skills/ — single source of truth, no copies
const MIRROR_TARGETS = [PATHS.pluginSkillsMirror, PATHS.rootSkillsMirror] as const

function expectedSymlinkTarget(targetRoot: string): string {
  return relative(dirname(targetRoot), PATHS.dataSkills)
}

export async function ensureMirrorSymlink(targetRoot: string): Promise<void> {
  const expectedTarget = expectedSymlinkTarget(targetRoot)

  // Fast path: existing correct symlink
  try {
    const stat = await lstat(targetRoot)
    if (stat.isSymbolicLink()) {
      const currentTarget = await readlink(targetRoot)
      if (currentTarget === expectedTarget) return
    }
    // Exists but not the right symlink — remove and recreate
    await rm(targetRoot, { recursive: true, force: true })
  } catch {
    // doesn't exist yet
  }

  await mkdir(dirname(targetRoot), { recursive: true })
  await symlink(expectedTarget, targetRoot)
}

export async function createMirrorSymlinks(): Promise<void> {
  for (const target of MIRROR_TARGETS) {
    await ensureMirrorSymlink(target)
  }
}

export async function pruneMirrors(_currentSlugs: readonly string[]): Promise<string[]> {
  // With root-level symlinks there is no per-skill pruning.
  return []
}

export async function validateMirrorSymlinks(): Promise<string[]> {
  const problems: string[] = []
  for (const targetRoot of MIRROR_TARGETS) {
    try {
      const stat = await lstat(targetRoot)
      if (!stat.isSymbolicLink()) {
        problems.push(`mirror not a symlink: ${targetRoot}`)
        continue
      }
      const currentTarget = await readlink(targetRoot)
      const expectedTarget = expectedSymlinkTarget(targetRoot)
      if (currentTarget !== expectedTarget) {
        problems.push(
          `mirror symlink target mismatch: ${targetRoot} → ${currentTarget} (expected ${expectedTarget})`,
        )
      }
    } catch {
      problems.push(`mirror missing: ${targetRoot}`)
    }
  }
  return problems
}

export async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await lstat(p)
    return s.isDirectory() || s.isSymbolicLink()
  } catch {
    return false
  }
}
