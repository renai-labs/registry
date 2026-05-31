import { cp, mkdir, readdir, rm, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { SkillEntry } from "@renai-labs/registry-schemas"
import { PATHS } from "./paths"

// mirrors are verbatim copies of data/skills/<slug>/ — frontmatter (incl. version) is left as-authored
const MIRROR_TARGETS = [PATHS.pluginSkillsMirror, PATHS.rootSkillsMirror] as const

export async function mirrorSkill(entry: SkillEntry): Promise<void> {
  for (const target of MIRROR_TARGETS) await mirrorSkillToDir(entry, target)
}

export async function pruneMirrors(currentSlugs: readonly string[]): Promise<string[]> {
  const keep = new Set(currentSlugs)
  const pruned: string[] = []
  for (const target of MIRROR_TARGETS) {
    if (!existsSync(target)) continue
    const entries = await readdir(target, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith(".")) continue
      if (keep.has(entry.name)) continue
      const full = join(target, entry.name)
      await rm(full, { recursive: true, force: true })
      pruned.push(full)
    }
  }
  return pruned
}

export async function mirrorSkillToDir(entry: SkillEntry, targetRoot: string): Promise<void> {
  const sourceDir = join(PATHS.dataSkills, entry.slug)
  const dest = join(targetRoot, entry.slug)
  await mkdir(targetRoot, { recursive: true })
  if (existsSync(dest)) await rm(dest, { recursive: true, force: true })
  await cp(sourceDir, dest, { recursive: true })
}

export async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p)
    return s.isDirectory()
  } catch {
    return false
  }
}
