import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

// ─── fixture helpers ─────────────────────────────────────────────────────────
//
// A fixture is a temp directory shaped like the real repo. Tests invoke the
// CLI as a subprocess (`bun cli/src/index.ts ...`) with RENREGISTRY_REPO_ROOT
// pointing at the fixture, so PATHS resolves against the fixture instead of
// the real repo. Subprocess isolation avoids module-cache reuse and exercises
// the actual entrypoint.

const CLI_ENTRY = resolve(import.meta.dir, "../src/index.ts")

export type CliResult = {
  status: number
  stdout: string
  stderr: string
}

export type Fixture = {
  root: string
  cleanup: () => Promise<void>
  /** Run the CLI with the given args. Optional env merges on top of RENREGISTRY_REPO_ROOT. */
  run: (args: string[], env?: Record<string, string>) => CliResult
  /** Convenience: read a file inside the fixture. */
  read: (relPath: string) => Promise<string>
  /** Write a file inside the fixture (creates parent dirs). */
  write: (relPath: string, content: string) => Promise<void>
  /** Absolute path inside the fixture. */
  path: (relPath: string) => string
  /** Run a git command inside the fixture (throws on non-zero exit). */
  git: (args: string[]) => { status: number; stdout: string }
}

export type FixtureSkill = {
  slug: string
  description?: string
  body?: string
  assets?: Record<string, string>
}

export type FixtureOptions = {
  skills?: FixtureSkill[]
  /** Initial skills.sh.json bundled list. Defaults to every seeded skill. */
  bundledSlugs?: string[]
  /** Seed data/skills.json with this value (otherwise file is absent). */
  skillsJson?: unknown
  claudePlugin?: Record<string, unknown>
  codexPlugin?: Record<string, unknown>
  /** Skip writing skills.sh.json (lets the test write its own). */
  skipSkillsSh?: boolean
}

export async function makeFixture(opts: FixtureOptions = {}): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "ren-registry-fixture-"))

  for (const sub of [
    "data/skills",
    "plugins/ren/.claude-plugin",
    "plugins/ren/.codex-plugin",
    "plugins/ren/skills",
    "skills",
    ".claude-plugin",
    ".agents/plugins",
  ]) {
    await mkdir(join(root, sub), { recursive: true })
  }

  const skills = opts.skills ?? []
  for (const s of skills) {
    const dir = join(root, "data", "skills", s.slug)
    await mkdir(dir, { recursive: true })
    const description = s.description ?? "Test skill"
    const body = s.body ?? `# ${s.slug}\n\nbody\n`
    await writeFile(
      join(dir, "SKILL.md"),
      `---\nname: ${s.slug}\ndescription: "${description}"\n---\n\n${body}`,
      "utf8",
    )
    for (const [path, content] of Object.entries(s.assets ?? {})) {
      const full = join(dir, path)
      await mkdir(join(full, ".."), { recursive: true })
      await writeFile(full, content, "utf8")
    }
  }

  if (!opts.skipSkillsSh) {
    const bundled = opts.bundledSlugs ?? skills.map((s) => s.slug)
    await writeFile(
      join(root, "skills.sh.json"),
      JSON.stringify({ groupings: [{ title: "Test", skills: bundled }] }, null, 2) + "\n",
      "utf8",
    )
  }

  const claudePlugin = opts.claudePlugin ?? {
    $schema: "https://json.schemastore.org/claude-code-plugin-manifest.json",
    name: "ren",
    description: "test plugin",
  }
  await writeFile(
    join(root, "plugins", "ren", ".claude-plugin", "plugin.json"),
    JSON.stringify(claudePlugin, null, 2) + "\n",
    "utf8",
  )

  const codexPlugin = opts.codexPlugin ?? {
    name: "ren",
    version: "0.1.0",
    description: "test plugin",
    skills: "./skills/",
  }
  await writeFile(
    join(root, "plugins", "ren", ".codex-plugin", "plugin.json"),
    JSON.stringify(codexPlugin, null, 2) + "\n",
    "utf8",
  )

  await writeFile(
    join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify(
      { name: "test", owner: { name: "Test" }, plugins: [{ name: "ren", source: "ren", description: "test" }] },
      null,
      2,
    ) + "\n",
    "utf8",
  )
  await writeFile(
    join(root, ".agents", "plugins", "marketplace.json"),
    JSON.stringify(
      { name: "test", owner: { name: "Test" }, plugins: [{ name: "ren", source: "./plugins/ren", description: "test" }] },
      null,
      2,
    ) + "\n",
    "utf8",
  )

  if (opts.skillsJson !== undefined) {
    await writeFile(join(root, "data", "skills.json"), JSON.stringify(opts.skillsJson, null, 2) + "\n", "utf8")
  }

  const run = (args: string[], extraEnv: Record<string, string> = {}): CliResult => {
    const env = { ...process.env, RENREGISTRY_REPO_ROOT: root, ...extraEnv }
    const r = spawnSync("bun", [CLI_ENTRY, ...args], { env, encoding: "utf8" })
    return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" }
  }

  const read = async (relPath: string): Promise<string> => {
    const { readFile } = await import("node:fs/promises")
    return readFile(join(root, relPath), "utf8")
  }

  const write = async (relPath: string, content: string): Promise<void> => {
    const { writeFile } = await import("node:fs/promises")
    await mkdir(join(root, relPath, ".."), { recursive: true })
    await writeFile(join(root, relPath), content, "utf8")
  }

  const path = (relPath: string): string => join(root, relPath)

  const git = (args: string[]): { status: number; stdout: string } => {
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@test",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@test",
    }
    const r = spawnSync("git", args, { cwd: root, env, encoding: "utf8" })
    if ((r.status ?? -1) !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`)
    }
    return { status: r.status ?? 0, stdout: r.stdout ?? "" }
  }

  return { root, cleanup: () => rm(root, { recursive: true, force: true }), run, read, write, path, git }
}

// ─── git-aware fixture helpers ──────────────────────────────────────────────

export function initGit(fx: Fixture): void {
  fx.git(["init", "-q", "-b", "main"])
  fx.git(["config", "commit.gpgsign", "false"])
}

export function gitCommitAll(fx: Fixture, message: string): string {
  fx.git(["add", "-A"])
  fx.git(["commit", "-q", "-m", message, "--no-verify"])
  return fx.git(["rev-parse", "HEAD"]).stdout.trim()
}
