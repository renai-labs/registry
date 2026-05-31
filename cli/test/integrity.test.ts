import { afterEach, describe, expect, test } from "bun:test"
import type { SkillsRegistry } from "@renai-labs/registry-schemas"
import { gitCommitAll, initGit, makeFixture, type Fixture } from "./fixtures"

let fx: Fixture | null = null

afterEach(async () => {
  if (fx) await fx.cleanup()
  fx = null
})

async function loadSnapshot(fixture: Fixture): Promise<SkillsRegistry> {
  return JSON.parse(await fixture.read("data/skills.json")) as SkillsRegistry
}

async function saveSnapshot(fixture: Fixture, snap: SkillsRegistry): Promise<void> {
  await fixture.write("data/skills.json", JSON.stringify(snap, null, 2) + "\n")
}

describe("frozen-version content integrity (check)", () => {
  test("passes when a frozen entry's contentHash matches what's at its gitRef", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    initGit(fx)
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const sha = gitCommitAll(fx, "initial publish state")

    // Pretend we published at this SHA — backfill gitRef in skills.json.
    const snap = await loadSnapshot(fx)
    snap[0]!.versions[0]!.gitRef = sha
    snap[0]!.versions[0]!.publishedAt = new Date().toISOString()
    await saveSnapshot(fx, snap)
    gitCommitAll(fx, "record SHA")

    const r = fx.run(["check"])
    expect(r.status).toBe(0)
  })

  test("flags frozen-mismatch when a frozen entry's contentHash is forged", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    initGit(fx)
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const sha = gitCommitAll(fx, "initial publish state")

    const snap = await loadSnapshot(fx)
    snap[0]!.versions[0]!.gitRef = sha
    snap[0]!.versions[0]!.publishedAt = new Date().toISOString()
    snap[0]!.versions[0]!.contentHash = "f".repeat(64) // forged
    snap[0]!.contentHash = "f".repeat(64)
    await saveSnapshot(fx, snap)

    const r = fx.run(["check"])
    expect(r.status).toBe(1)
    expect(r.stderr + r.stdout).toContain("frozen-mismatch: pod-dev@0.0.1")
  })

  test("warns (not fails) when gitRef is unreachable", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    initGit(fx)
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    gitCommitAll(fx, "initial publish state")

    const snap = await loadSnapshot(fx)
    snap[0]!.versions[0]!.gitRef = "0".repeat(40) // valid hex, nonexistent
    snap[0]!.versions[0]!.publishedAt = new Date().toISOString()
    await saveSnapshot(fx, snap)
    gitCommitAll(fx, "fake gitRef")

    const r = fx.run(["check"])
    // Unreachable refs surface as warnings — they don't fail the check by
    // themselves. The build still fails on mirror drift further down, but
    // the integrity warning prints first.
    expect(r.stderr + r.stdout).toContain("frozen-skipped: pod-dev@0.0.1")
  })
})

describe("PR-base diff (check)", () => {
  test("no issues when nothing changed between base and HEAD", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    initGit(fx)
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const baseline = gitCommitAll(fx, "baseline")
    // Mark version as published at HEAD.
    const snap = await loadSnapshot(fx)
    snap[0]!.versions[0]!.gitRef = baseline
    snap[0]!.versions[0]!.publishedAt = new Date().toISOString()
    await saveSnapshot(fx, snap)
    const recorded = gitCommitAll(fx, "record SHA")

    const r = fx.run(["check"], { RENREGISTRY_BASE_REF: recorded })
    expect(r.status).toBe(0)
  })

  test("flags frozen-removed when a published entry disappears between base and HEAD", async () => {
    fx = await makeFixture({
      skills: [{ slug: "pod-dev" }, { slug: "agent-dev" }],
      bundledSlugs: ["pod-dev", "agent-dev"],
    })
    initGit(fx)
    fx.run(["release", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const baseline = gitCommitAll(fx, "baseline")

    // Mark BOTH skills as published.
    const snap = await loadSnapshot(fx)
    for (const s of snap) {
      s.versions[0]!.gitRef = baseline
      s.versions[0]!.publishedAt = new Date().toISOString()
    }
    await saveSnapshot(fx, snap)
    const recorded = gitCommitAll(fx, "publish both")

    // Now drop agent-dev from the snapshot.
    const next = await loadSnapshot(fx)
    const filtered = next.filter((s) => s.slug !== "agent-dev")
    await saveSnapshot(fx, filtered)

    const r = fx.run(["check"], { RENREGISTRY_BASE_REF: recorded })
    expect(r.status).toBe(1)
    expect(r.stderr + r.stdout).toContain("frozen-removed: agent-dev@0.0.1")
  })

  test("flags frozen-hash-changed when a published entry's contentHash mutates", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    initGit(fx)
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const baseline = gitCommitAll(fx, "baseline")

    const snap = await loadSnapshot(fx)
    snap[0]!.versions[0]!.gitRef = baseline
    snap[0]!.versions[0]!.publishedAt = new Date().toISOString()
    const originalHash = snap[0]!.versions[0]!.contentHash
    await saveSnapshot(fx, snap)
    const recorded = gitCommitAll(fx, "publish")

    // Mutate the recorded hash post-publish.
    const next = await loadSnapshot(fx)
    next[0]!.versions[0]!.contentHash = "f".repeat(64)
    next[0]!.contentHash = "f".repeat(64)
    await saveSnapshot(fx, next)

    const r = fx.run(["check"], { RENREGISTRY_BASE_REF: recorded })
    expect(r.status).toBe(1)
    const out = r.stderr + r.stdout
    expect(out).toContain("frozen-hash-changed: pod-dev@0.0.1")
    expect(originalHash).not.toBe("f".repeat(64))
  })

  test("does not flag new pending entries (gitRef null in HEAD only)", async () => {
    fx = await makeFixture({ skills: [{ slug: "pod-dev" }] })
    initGit(fx)
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])
    fx.run(["build"])
    const baseline = gitCommitAll(fx, "baseline")
    const snap = await loadSnapshot(fx)
    snap[0]!.versions[0]!.gitRef = baseline
    snap[0]!.versions[0]!.publishedAt = new Date().toISOString()
    await saveSnapshot(fx, snap)
    const recorded = gitCommitAll(fx, "publish 0.0.1")

    // New release adds a pending entry; should NOT trigger any frozen-* diff
    // because the new entry has gitRef === null.
    const original = await fx.read("data/skills/pod-dev/SKILL.md")
    await fx.write("data/skills/pod-dev/SKILL.md", original + "more\n")
    fx.run(["release", "pod-dev", "--bump", "patch", "--yes"])

    const r = fx.run(["check"], { RENREGISTRY_BASE_REF: recorded })
    expect(r.stderr + r.stdout).not.toContain("frozen-removed")
    expect(r.stderr + r.stdout).not.toContain("frozen-gitref-changed")
    expect(r.stderr + r.stdout).not.toContain("frozen-hash-changed")
  })
})
