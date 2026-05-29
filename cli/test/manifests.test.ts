import { describe, expect, test } from "bun:test"
import type { SkillsShManifest } from "@renai-labs/registry-schemas"
import { bundledSlugs, decidePluginBump, reconcileSkillsShManifest } from "@/lib/manifests"

describe("decidePluginBump", () => {
  const base = { priorVersion: "0.1.0", forceMajor: false, firstBuild: false }

  test("firstBuild bootstraps without bumping", () => {
    const r = decidePluginBump({
      ...base,
      firstBuild: true,
      prior: new Map(),
      current: new Map([["pod-dev", "0.0.1"]]),
    })
    expect(r.next).toBe("0.1.0")
    expect(r.reason).toBe("first build (bootstrap)")
  })

  test("no change → no bump", () => {
    const r = decidePluginBump({
      ...base,
      prior: new Map([["pod-dev", "0.0.1"]]),
      current: new Map([["pod-dev", "0.0.1"]]),
    })
    expect(r.next).toBe("0.1.0")
    expect(r.reason).toBe("no change")
  })

  test("any bundled skill version change → patch bump", () => {
    const r = decidePluginBump({
      ...base,
      prior: new Map([["pod-dev", "0.0.1"]]),
      current: new Map([["pod-dev", "0.0.2"]]),
    })
    expect(r.next).toBe("0.1.1")
    expect(r.reason).toContain("1 skill version(s) changed")
  })

  test("added bundled skill → minor bump", () => {
    const r = decidePluginBump({
      ...base,
      prior: new Map([["pod-dev", "0.0.1"]]),
      current: new Map([
        ["pod-dev", "0.0.1"],
        ["agent-dev", "0.0.1"],
      ]),
    })
    expect(r.next).toBe("0.2.0")
    expect(r.reason).toContain("+1")
  })

  test("removed bundled skill → minor bump", () => {
    const r = decidePluginBump({
      ...base,
      prior: new Map([
        ["pod-dev", "0.0.1"],
        ["agent-dev", "0.0.1"],
      ]),
      current: new Map([["pod-dev", "0.0.1"]]),
    })
    expect(r.next).toBe("0.2.0")
    expect(r.reason).toContain("-1")
  })

  test("set add + version change in same build → minor takes precedence", () => {
    const r = decidePluginBump({
      ...base,
      prior: new Map([["pod-dev", "0.0.1"]]),
      current: new Map([
        ["pod-dev", "0.0.2"],
        ["agent-dev", "0.0.1"],
      ]),
    })
    expect(r.next).toBe("0.2.0")
    expect(r.reason).toContain("skill set changed")
  })

  test("forceMajor overrides every other signal", () => {
    const r = decidePluginBump({
      ...base,
      forceMajor: true,
      prior: new Map([["pod-dev", "0.0.1"]]),
      current: new Map([["pod-dev", "0.0.1"]]),
    })
    expect(r.next).toBe("1.0.0")
    expect(r.reason).toBe("explicit --plugin-major")
  })
})

describe("bundledSlugs", () => {
  test("dedupes across groupings", () => {
    const m: SkillsShManifest = {
      groupings: [
        { title: "A", skills: ["pod-dev", "agent-dev"] },
        { title: "B", skills: ["agent-dev", "skill-dev"] },
      ],
    }
    expect(bundledSlugs(m).sort()).toEqual(["agent-dev", "pod-dev", "skill-dev"])
  })

  test("empty manifest produces empty set", () => {
    expect(bundledSlugs({ groupings: [] })).toEqual([])
  })
})

describe("reconcileSkillsShManifest", () => {
  test("prunes slugs that no longer exist", () => {
    const m: SkillsShManifest = {
      groupings: [{ title: "Ren", skills: ["pod-dev", "deleted-skill", "agent-dev"] }],
    }
    const result = reconcileSkillsShManifest(m, ["pod-dev", "agent-dev"])
    expect(result.groupings[0]!.skills).toEqual(["pod-dev", "agent-dev"])
  })

  test("never auto-adds new slugs", () => {
    const m: SkillsShManifest = { groupings: [{ title: "Ren", skills: ["pod-dev"] }] }
    const result = reconcileSkillsShManifest(m, ["pod-dev", "newly-added-content-skill"])
    expect(result.groupings[0]!.skills).toEqual(["pod-dev"])
  })

  test("preserves grouping titles and descriptions", () => {
    const m: SkillsShManifest = {
      groupings: [{ title: "Ren Meta", description: "Curated", skills: ["pod-dev"] }],
    }
    const result = reconcileSkillsShManifest(m, ["pod-dev"])
    expect(result.groupings[0]!.title).toBe("Ren Meta")
    expect(result.groupings[0]!.description).toBe("Curated")
  })

  test("preserves $schema field", () => {
    const m: SkillsShManifest = {
      $schema: "https://www.skills.sh/schema/skills.sh.json",
      groupings: [{ title: "Ren", skills: ["pod-dev"] }],
    }
    const result = reconcileSkillsShManifest(m, ["pod-dev"])
    expect(result.$schema).toBe("https://www.skills.sh/schema/skills.sh.json")
  })
})
