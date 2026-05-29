import { discoverSkillSlugs } from "@/lib/snapshot"
import { FrontmatterError, parseSkill } from "@/lib/frontmatter"
import { log } from "@/lib/log"

export type ValidateResult = { ok: boolean; errors: string[] }

export async function validate(): Promise<ValidateResult> {
  const slugs = await discoverSkillSlugs()
  const errors: string[] = []

  for (const slug of slugs) {
    try {
      await parseSkill(slug)
    } catch (e) {
      if (e instanceof FrontmatterError) {
        errors.push(e.message)
      } else {
        errors.push(`${slug}: ${(e as Error).message}`)
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

export async function runValidateCommand(): Promise<void> {
  log.header("validate")
  const slugs = await discoverSkillSlugs()
  log.step(`${slugs.length} skill(s) discovered`)
  const { ok, errors } = await validate()
  if (!ok) {
    for (const e of errors) log.err(e)
    process.exit(1)
  }
  log.ok(`validated ${slugs.length} skill(s)`)
}
