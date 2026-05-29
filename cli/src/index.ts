#!/usr/bin/env bun
import { Command } from "commander"
import { Bump } from "@renai-labs/registry-schemas"
import { runValidateCommand } from "@/commands/validate"
import { runCheckCommand } from "@/commands/check"
import { runReleaseCommand } from "@/commands/release"
import { runBuildCommand } from "@/commands/build"
import { runPublishCommand } from "@/commands/publish"
import { runBumpPluginMajor } from "@/commands/bump"
import { log } from "@/lib/log"

const program = new Command()
  .name("ren-registry")
  .description("Manage Ren skills, plugin manifests, and registry publishing")
  .version("0.0.0")

program
  .command("validate")
  .description("Validate every SKILL.md frontmatter")
  .action(async () => {
    await runValidateCommand()
  })

program
  .command("check")
  .description("Validate + drift + scratch-build diff. The CI guard.")
  .action(async () => {
    await runCheckCommand()
  })

program
  .command("release [slug...]")
  .description("Record a new version for changed skills in data/skills.json")
  .option("--bump <type>", "patch | minor | major", "patch")
  .option("--yes", "skip confirmation (CI / scripted use)", false)
  .action(async (slugs: string[], opts: { bump: string; yes: boolean }) => {
    const parsed = Bump.safeParse(opts.bump)
    if (!parsed.success) {
      log.err(`--bump must be patch | minor | major (got "${opts.bump}")`)
      process.exit(1)
    }
    await runReleaseCommand(slugs, { bump: parsed.data, yes: opts.yes })
  })

program
  .command("build")
  .description("Regenerate mirrors, plugin manifests, skills.sh.json")
  .action(async () => {
    await runBuildCommand()
  })

program
  .command("publish")
  .description("Build, commit, POST to the Ren registry")
  .option("--dry-run", "skip the HTTP POST (still commits + tags)", false)
  .action(async (opts: { dryRun: boolean }) => {
    await runPublishCommand({ dryRun: opts.dryRun })
  })

program
  .command("bump")
  .description("Plugin-level overrides (skill versions come from `release`)")
  .option("--plugin-major", "mark next build to major-bump the plugin", false)
  .action(async (opts: { pluginMajor: boolean }) => {
    if (opts.pluginMajor) {
      await runBumpPluginMajor()
      return
    }
    log.err("bump: no flag set — try --plugin-major")
    process.exit(1)
  })

program.parseAsync().catch((e) => {
  log.err(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
