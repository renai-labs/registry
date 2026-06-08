import { afterEach, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { lstat, readlink, readdir } from "node:fs/promises"
import type { SkillsRegistry } from "@renai-labs/registry-schemas"
import { gitCommitAll, initGit, makeFixture, type Fixture } from "./fixtures"

let fx: Fixture | null = null

afterEach(async () => {
  if (fx) await fx.cleanup()
  fx = null
})

async function loadSkillsJson(fixture: Fixture): Promise<SkillsRegistry> {
  return JSON.parse(await fixture.read("data/skills.json")) as SkillsRegistry
}

async function isSymlinkTo(path: string, expectedTarget: string): Promise<boolean> {
  try {
    const stat = await lstat(path)
    if (!stat.isSymbolicLink()) return false
    const target = await readlink(path)
    return target === expectedTarget
  } catch {
    return false
  }
}

describe("validate", () => {
  test("exits 0 on a clean fixture", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    const r = fx.run(["validate"])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain("validated 1 skill(s)")
  })

  test("exits non-zero when a SKILL.md has `version:` in frontmatter", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    await fx.write(
      "data/skills/pod-dev/SKILL.md",
      `---\nname: pod-dev\ndescription: "x"\nversion: "1.0.0"\n---\n\n# body\n`,
    )
    const r = fx.run(["validate"])
    expect(r.status).toBe(1)
    const out = r.stderr + r.stdout
    expect(out).toContain("Unrecognized key")
    expect(out).toContain("version is owned by data/skills.json")
  })
})

describe("release", () => {
  test("seeds an initial entry on first release", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    const r = fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain("(initial) → 0.0.1")
    const snap = await loadSkillsJson(fx)
    expect(snap).toHaveLength(1)
    const pd = snap[0]!
    expect(pd.slug).toBe("pod-dev")
    expect(pd.currentVersion).toBe("0.0.1")
    expect(pd.versions).toHaveLength(1)
    expect(pd.versions[0]!.gitRef).toBeNull()
  })

  test("initial version follows the --bump flag", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    const r = fx.run(["release", "pod-dev", "--bump", "minor", "--yes"])
    expect(r.status).toBe(0)
    const snap = await loadSkillsJson(fx)
    expect(snap[0]!.currentVersion).toBe("0.1.0")
  })

  test("skips when content is unchanged", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    const r2 = fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    expect(r2.status).toBe(0)
    expect(r2.stdout).toContain("no content change since last release")
    const snap = await loadSkillsJson(fx)
    expect(snap[0]!.versions).toHaveLength(1)
  })

  test("appends a new version when content changes", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    const original = await fx.read("data/skills/pod-dev/SKILL.md")
    await fx.write("data/skills/pod-dev/SKILL.md", original + "more content\n")
    const r = fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain("0.0.1 → 0.0.2")
    const snap = await loadSkillsJson(fx)
    expect(snap[0]!.versions).toHaveLength(2)
    expect(snap[0]!.currentVersion).toBe("0.0.2")
  })

  test("rejects unknown slug", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    const r = fx.run(["release", "ghostslug", "--bump", "patch", "--yes"])
    expect(r.status).toBe(1)
    expect(r.stderr + r.stdout).toContain("unknown skill")
  })

  test("re-release refreshes description from edited frontmatter", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev", description: "old desc" }] })
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    await fx.write("data/skills/pod-dev/SKILL.md", `---\nname: pod-dev\ndescription: "new desc"\n---\n\n# pod-dev\n\nedited\n`)
    const r = fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    expect(r.status).toBe(0)
    expect((await loadSkillsJson(fx))[0]!.description).toBe("new desc")
  })

  test("derives metadata from frontmatter on release", async () => {
    fx = await makeFixture({ skills: [{ slug: "shopify" }] })
    await fx.write(
      "data/skills/shopify/SKILL.md",
      `---\nname: shopify\ndescription: "desc"\nmetadata:\n  author: Ren Labs\n  requiredCredentials:\n    - name: SHOPIFY_ACCESS_TOKEN\n---\n\n# shopify\n`,
    )
    fx.run(["release", "shopify", "--bump", "patch", "--yes"])

    const after = await loadSkillsJson(fx)
    expect(after[0]!.metadata).toEqual({ author: "Ren Labs", requiredCredentials: [{ name: "SHOPIFY_ACCESS_TOKEN" }] })
  })

  test("re-release regenerates metadata from edited frontmatter, dropping removed keys", async () => {
    fx = await makeFixture({ skills: [{ slug: "shopify" }] })
    await fx.write(
      "data/skills/shopify/SKILL.md",
      `---\nname: shopify\ndescription: "desc"\nmetadata:\n  author: Ren Labs\n  tags:\n    - commerce\n---\n\n# shopify\n`,
    )
    fx.run(["release", "shopify", "--bump", "patch", "--yes"])
    await fx.write(
      "data/skills/shopify/SKILL.md",
      `---\nname: shopify\ndescription: "desc"\nmetadata:\n  author: Ren Labs\n---\n\n# shopify\n`,
    )
    fx.run(["release", "shopify", "--bump", "patch", "--yes"])

    const after = await loadSkillsJson(fx)
    expect(after[0]!.versions).toHaveLength(2)
    expect(after[0]!.metadata).toEqual({ author: "Ren Labs" })
  })
})

describe("build", () => {
  test("refuses on drift (released skill edited without re-release)", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    const original = await fx.read("data/skills/pod-dev/SKILL.md")
    await fx.write("data/skills/pod-dev/SKILL.md", original + "drift\n")
    const r = fx.run(["build"])
    expect(r.status).toBe(1)
    expect(r.stderr + r.stdout).toContain("drift: pod-dev")
  })

  test("refuses on unreleased (new skill never released)", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    const r = fx.run(["build"])
    expect(r.status).toBe(1)
    expect(r.stderr + r.stdout).toContain("unreleased: pod-dev")
  })

  test("refuses when skills.sh.json names a missing slug", async () => {
    fx = await makeFixture({
      skills: [{ slug: "pod-dev" }],
      bundledSlugs: ["pod-dev", "ghost-skill"],
    })
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    const r = fx.run(["build"])
    expect(r.status).toBe(1)
    expect(r.stderr + r.stdout).toContain("bundled-missing: ghost-skill")
  })

  test("creates symlinks that expose all skills", async () => {
    fx = await makeFixture({
      skills: [{ slug: "pod-dev" }, { slug: "content-skill" }],
      bundledSlugs: ["pod-dev"],
    })
    fx.run(["release", "--bump", "patch", "--yes"])
    const r = fx.run(["build"])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain("mirrored 1/2 skill(s)")

    // Mirrors are symlinks to data/skills/
    expect(await isSymlinkTo(fx.path("plugins/ren/skills"), "../../data/skills")).toBe(true)
    expect(await isSymlinkTo(fx.path("skills"), "data/skills")).toBe(true)

    // Symlinks resolve to data/skills/, so all skills are reachable
    const pluginDirs = await readdir(fx.path("plugins/ren/skills"))
    expect(pluginDirs.sort()).toEqual(["content-skill", "pod-dev"])
    const rootDirs = await readdir(fx.path("skills"))
    expect(rootDirs.sort()).toEqual(["content-skill", "pod-dev"])
  })

  test("symlinks resolve to the source SKILL.md verbatim", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    fx.run(["release", "pod-dev", "--bump", "minor", "--yes"])
    fx.run(["build"])
    const source = await fx.read("data/skills/pod-dev/SKILL.md")
    const mirrored = await fx.read("plugins/ren/skills/pod-dev/SKILL.md")
    expect(mirrored).toBe(source)
    expect(mirrored).not.toContain("version:")
  })

  test("bumps plugin patch when a bundled skill version changes vs the base ref", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    initGit(fx)
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"]) // no base ref yet → bootstrap, inherits the seeded 0.1.0
    const claudeAfterBootstrap = JSON.parse(await fx.read(".claude-plugin/plugin.json")) as {
      version: string
    }
    expect(claudeAfterBootstrap.version).toBe("0.1.0")
    const base = gitCommitAll(fx, "base: pod-dev 0.0.1 @ plugin 0.1.0")

    // Content changes → build diffed against the committed base should patch-bump.
    const original = await fx.read("data/skills/pod-dev/SKILL.md")
    await fx.write("data/skills/pod-dev/SKILL.md", original + "more\n")
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"], { RENREGISTRY_BASE_REF: base })

    const claudeAfter = JSON.parse(await fx.read(".claude-plugin/plugin.json")) as { version: string }
    expect(claudeAfter.version).toBe("0.1.1")
    const codexAfter = JSON.parse(await fx.read(".codex-plugin/plugin.json")) as { version: string }
    expect(codexAfter.version).toBe("0.1.1")
  })

  test("repeated builds against the same base are idempotent (no double-bump)", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    initGit(fx)
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const base = gitCommitAll(fx, "base")

    const original = await fx.read("data/skills/pod-dev/SKILL.md")
    await fx.write("data/skills/pod-dev/SKILL.md", original + "more\n")
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"], { RENREGISTRY_BASE_REF: base })
    fx.run(["build"], { RENREGISTRY_BASE_REF: base })

    const v = JSON.parse(await fx.read(".claude-plugin/plugin.json")) as { version: string }
    expect(v.version).toBe("0.1.1")
  })

  test("second build is a no-op (deterministic)", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const before = await fx.read("plugins/ren/skills/pod-dev/SKILL.md")
    const beforeIsLink = await isSymlinkTo(fx.path("plugins/ren/skills"), "../../data/skills")
    fx.run(["build"])
    const after = await fx.read("plugins/ren/skills/pod-dev/SKILL.md")
    const afterIsLink = await isSymlinkTo(fx.path("plugins/ren/skills"), "../../data/skills")
    expect(after).toBe(before)
    expect(afterIsLink).toBe(beforeIsLink)
  })

  test("symlinks stay intact when bundled set shrinks", async () => {
    fx = await makeFixture({
      skills: [{ slug: "pod-dev" }, { slug: "agent-dev" }],
      bundledSlugs: ["pod-dev", "agent-dev"],
    })
    fx.run(["release", "--bump", "patch", "--yes"])
    fx.run(["build"])
    expect(await isSymlinkTo(fx.path("plugins/ren/skills"), "../../data/skills")).toBe(true)

    // Remove agent-dev from skills.sh.json
    await fx.write(
      "skills.sh.json",
      JSON.stringify({ groupings: [{ title: "Test", skills: ["pod-dev"] }] }, null, 2) + "\n",
    )
    fx.run(["build"])
    // Symlink is still there — it always points to data/skills/ which holds everything
    expect(await isSymlinkTo(fx.path("plugins/ren/skills"), "../../data/skills")).toBe(true)
    // agent-dev is still reachable through the symlink
    expect(existsSync(fx.path("plugins/ren/skills/agent-dev"))).toBe(true)
  })
})

describe("check", () => {
  test("clean fixture: validate + drift + scratch-build all pass", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const r = fx.run(["check"])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain("registry coherent")
  })

  test("flags mirror drift when build outputs aren't committed", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    // No build → mirrors absent
    const r = fx.run(["check"])
    expect(r.status).toBe(1)
    expect(r.stderr + r.stdout).toContain("mirror missing")
  })
})
