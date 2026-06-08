import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  build,
  detectDerivationIssues,
  detectDrift,
  detectFrozenIntegrityIssues,
  detectPrBaseDiffIssues,
  detectSelfConsistencyIssues,
  formatDriftProblems,
} from "@/lib/build"
import { loadSkillsRegistry } from "@/lib/snapshot"
import { validateChangedMcps } from "@/lib/mcp-validate"
import { validate } from "@/commands/validate"
import { diffFiles } from "@/lib/diff"
import { validateMirrorSymlinks } from "@/lib/mirror"
import { PATHS } from "@/lib/paths"
import { log } from "@/lib/log"

export type CheckResult = { ok: boolean; problems: string[] }

export async function check(): Promise<CheckResult> {
  const problems: string[] = []

  const v = await validate()
  if (!v.ok) problems.push(...v.errors)

  const snapshot = await loadSkillsRegistry()
  problems.push(...detectSelfConsistencyIssues(snapshot))
  problems.push(...(await detectDerivationIssues(snapshot)))

  const frozen = await detectFrozenIntegrityIssues(snapshot)
  for (const issue of frozen) {
    if (issue.kind === "ref-missing") {
      log.warn(`frozen-skipped: ${issue.slug}@${issue.version} — ${issue.detail}`)
    } else {
      problems.push(`frozen-mismatch: ${issue.slug}@${issue.version} — ${issue.detail}`)
    }
  }

  const baseDiff = await detectPrBaseDiffIssues(snapshot)
  for (const issue of baseDiff.issues) {
    problems.push(`frozen-${issue.kind}: ${issue.slug}@${issue.version} — ${issue.detail}`)
  }
  if (baseDiff.usedBaseRef && baseDiff.issues.length === 0) {
    log.step(`base-diff vs ${baseDiff.usedBaseRef.slice(0, 7)}: clean`)
  }

  problems.push(...formatDriftProblems(await detectDrift()))

  const mcp = await validateChangedMcps()
  if (mcp.results.length) {
    const bad = mcp.results.filter((r) => !r.compatible)
    if (bad.length) {
      for (const r of bad) log.warn(`mcp ${r.slug}: ${r.detail}`)
    } else {
      log.step(`mcp: ${mcp.results.length} changed server(s) validated, all Ren-compatible`)
    }
  }

  if (problems.length) return { ok: false, problems }

  const tmp = await mkdtemp(join(tmpdir(), "ren-registry-check-"))
  try {
    const scratch = {
      pluginSkillsMirror: join(tmp, "plugin-skills"),
      rootSkillsMirror: join(tmp, "root-skills"),
      claudePluginJson: join(tmp, "claude-plugin.json"),
      codexPluginJson: join(tmp, "codex-plugin.json"),
      skillsShJson: join(tmp, "skills.sh.json"),
    }
    await build({ scratch, skipDriftCheck: true })

    const mirrorProblems = await validateMirrorSymlinks()
    if (mirrorProblems.length) {
      problems.push(
        ...mirrorProblems.map((p) => `${p}; run \`ren-registry build && git add -A\``),
      )
    }

    const claudeFileDiff = await diffFiles(PATHS.claudePluginJson, scratch.claudePluginJson)
    if (claudeFileDiff !== "equal") {
      problems.push(`manifest drift: plugins/ren/.claude-plugin/plugin.json — run \`ren-registry build\``)
    }
    const codexFileDiff = await diffFiles(PATHS.codexPluginJson, scratch.codexPluginJson)
    if (codexFileDiff !== "equal") {
      problems.push(`manifest drift: plugins/ren/.codex-plugin/plugin.json — run \`ren-registry build\``)
    }
    const sshDiff = await diffFiles(PATHS.skillsShJson, scratch.skillsShJson)
    if (sshDiff !== "equal") {
      problems.push(`manifest drift: skills.sh.json — run \`ren-registry build\``)
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }

  return { ok: problems.length === 0, problems }
}

export async function runCheckCommand(): Promise<void> {
  log.header("check")
  const result = await check()
  if (!result.ok) {
    for (const p of result.problems) log.err(p)
    process.exit(1)
  }
  log.ok("registry coherent across all distribution channels")
}
