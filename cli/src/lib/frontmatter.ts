import { readFile } from "node:fs/promises"
import { join } from "node:path"
import matter from "gray-matter"
import { z } from "zod"
import { SkillFrontmatter } from "@renai-labs/registry-schemas"
import { PATHS } from "./paths"

export type ParsedSkill = {
  slug: string
  dir: string
  skillMdPath: string
  frontmatter: SkillFrontmatter
  body: string
  raw: string
}

export class FrontmatterError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: string[],
  ) {
    super(`frontmatter invalid: ${path}\n  - ${issues.join("\n  - ")}`)
    this.name = "FrontmatterError"
  }
}

export async function parseSkill(slug: string): Promise<ParsedSkill> {
  const dir = join(PATHS.dataSkills, slug)
  const skillMdPath = join(dir, "SKILL.md")
  const raw = await readFile(skillMdPath, "utf8")
  const parsed = matter(raw)
  const result = SkillFrontmatter.safeParse(parsed.data)
  if (!result.success) {
    const issues = result.error.issues.map((i) => {
      const path = i.path.join(".")
      const keys = (i as { keys?: string[] }).keys
      const hasVersionKey = path === "version" || keys?.includes("version")
      const hint = hasVersionKey
        ? ` (use \`ren-registry release ${slug}\` instead — version is owned by data/skills.json)`
        : ""
      return `${path || "<root>"}: ${i.message}${hint}`
    })
    throw new FrontmatterError(skillMdPath, issues)
  }

  // agentskills validator parity: name is NFKC-normalized and must match the parent directory.
  if (result.data.name.normalize("NFKC") !== slug) {
    throw new FrontmatterError(skillMdPath, [
      `name: "${result.data.name}" must match the parent directory name "${slug}"`,
    ])
  }

  return { slug, dir, skillMdPath, frontmatter: result.data, body: parsed.content, raw }
}

export function stringifyWithFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  // Use gray-matter to round-trip. forceQuotes prevents YAML version-as-number bugs.
  return matter.stringify(body, frontmatter, { language: "yaml" })
}

export { z }
