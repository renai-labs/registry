import { mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import semver from "semver"
import {
  AgentsRegistry,
  type AgentEntry,
  Bump,
  McpsRegistry,
  type McpEntry,
  SkillsRegistry,
  type SkillEntry,
  type SkillVersionEntry,
  TagsRegistry,
  type TagEntry,
} from "@renai-labs/registry-schemas"
import { PATHS } from "./paths"
import { readJsonOr, writeJson } from "./json"

function makeRegistry<T>(path: string, schema: { parse: (x: unknown) => T[] }, key: (e: T) => string) {
  return {
    load: async (): Promise<T[]> => schema.parse(await readJsonOr<unknown>(path, [])),
    save: async (entries: T[]): Promise<void> => {
      const sorted = [...entries].sort((a, b) => key(a).localeCompare(key(b)))
      schema.parse(sorted)
      await writeJson(path, sorted)
    },
  }
}

const skillsReg = makeRegistry<SkillEntry>(PATHS.skillsJson, SkillsRegistry, (e) => e.slug)
const agentsReg = makeRegistry<AgentEntry>(PATHS.agentsJson, AgentsRegistry, (e) => e.agent.slug)
const mcpsReg = makeRegistry<McpEntry>(PATHS.mcpsJson, McpsRegistry, (e) => e.slug)
const tagsReg = makeRegistry<TagEntry>(PATHS.tagsJson, TagsRegistry, (e) => e.name)

export const loadSkillsRegistry = skillsReg.load
export const saveSkillsRegistry = skillsReg.save
export const loadAgentsRegistry = agentsReg.load
export const saveAgentsRegistry = agentsReg.save
export const loadMcpsRegistry = mcpsReg.load
export const saveMcpsRegistry = mcpsReg.save
export const loadTagsRegistry = tagsReg.load
export const saveTagsRegistry = tagsReg.save

export async function discoverSkillSlugs(): Promise<string[]> {
  if (!existsSync(PATHS.dataSkills)) return []
  const entries = await readdir(PATHS.dataSkills, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .filter((e) => existsSync(join(PATHS.dataSkills, e.name, "SKILL.md")))
    .map((e) => e.name)
    .sort()
}

export function bumpVersion(current: string, bump: Bump): string {
  const next = semver.inc(current, bump)
  if (!next) throw new Error(`bumpVersion: cannot ${bump} on ${current}`)
  return next
}

export function highestVersion(entry: SkillEntry): SkillVersionEntry | undefined {
  return [...entry.versions].sort((a, b) => semver.rcompare(a.version, b.version))[0]
}

export function findVersion(entry: SkillEntry, version: string): SkillVersionEntry | undefined {
  return entry.versions.find((v) => v.version === version)
}

export function pluginMajorMarkerExists(): boolean {
  return existsSync(PATHS.pluginMajorMarker)
}

export async function clearPluginMajorMarker(): Promise<void> {
  if (pluginMajorMarkerExists()) await rm(PATHS.pluginMajorMarker)
}

export async function setPluginMajorMarker(reason: string): Promise<void> {
  await mkdir(dirname(PATHS.pluginMajorMarker), { recursive: true })
  await writeFile(PATHS.pluginMajorMarker, `${reason}\n`, "utf8")
}
