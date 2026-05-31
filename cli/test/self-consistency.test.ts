import { describe, expect, test } from "bun:test"
import type { SkillEntry, SkillVersionEntry } from "@renai-labs/registry-schemas"
import { detectSelfConsistencyIssues } from "@/lib/build"

function v(version: string, contentHash = "h"): SkillVersionEntry {
  return { version, gitRef: null, publishedAt: null, contentHash }
}

function entry(overrides: Partial<SkillEntry> = {}): SkillEntry {
  return {
    slug: "pod-dev",
    name: "pod-dev",
    description: "x",
    currentVersion: "0.0.1",
    contentHash: "h",
    versions: [v("0.0.1")],
    ...overrides,
  }
}

describe("detectSelfConsistencyIssues", () => {
  test("clean entry produces no issues", () => {
    expect(detectSelfConsistencyIssues([entry()])).toEqual([])
  })

  test("clean multi-version entry produces no issues", () => {
    const e = entry({
      currentVersion: "0.1.0",
      contentHash: "hv2",
      versions: [v("0.0.1"), v("0.1.0", "hv2")],
    })
    expect(detectSelfConsistencyIssues([e])).toEqual([])
  })

  test("currentVersion not in versions[] is flagged", () => {
    const e = entry({ currentVersion: "9.9.9" })
    const issues = detectSelfConsistencyIssues([e])
    expect(issues.join("\n")).toContain("currentVersion 9.9.9 is not the highest")
  })

  test("currentVersion exists in versions[] but isn't the max", () => {
    const e = entry({
      currentVersion: "0.0.1",
      versions: [v("0.0.1"), v("0.0.2")],
    })
    const issues = detectSelfConsistencyIssues([e])
    expect(issues.join("\n")).toContain("currentVersion 0.0.1 is not the highest")
  })

  test("duplicate version is flagged", () => {
    const e = entry({
      currentVersion: "0.0.1",
      versions: [v("0.0.1"), v("0.0.1")],
    })
    const issues = detectSelfConsistencyIssues([e])
    expect(issues.some((i) => i.includes("duplicate version 0.0.1"))).toBe(true)
  })

  test("non-monotonic versions[] is flagged", () => {
    const e = entry({
      currentVersion: "0.0.2",
      versions: [v("0.0.2"), v("0.0.1")],
    })
    const issues = detectSelfConsistencyIssues([e])
    expect(issues.some((i) => i.includes("not sorted ascending"))).toBe(true)
  })

  test("currentVersion.contentHash mismatch is flagged", () => {
    const e = entry({
      currentVersion: "0.0.1",
      contentHash: "forged",
      versions: [v("0.0.1", "real")],
    })
    const issues = detectSelfConsistencyIssues([e])
    expect(
      issues.some((i) => i.includes("currentVersion.contentHash differs")),
    ).toBe(true)
  })

  test("multiple issues across multiple skills are aggregated", () => {
    const bad1 = entry({
      slug: "pod-dev",
      currentVersion: "9.9.9",
    })
    const bad2 = entry({
      slug: "agent-dev",
      name: "agent-dev",
      currentVersion: "0.0.1",
      versions: [v("0.0.1"), v("0.0.1")], // duplicate
    })
    const issues = detectSelfConsistencyIssues([bad1, bad2])
    expect(issues.length).toBeGreaterThanOrEqual(2)
    expect(issues.some((i) => i.startsWith("self-consistency: pod-dev"))).toBe(true)
    expect(issues.some((i) => i.startsWith("self-consistency: agent-dev"))).toBe(true)
  })

  test("semver ordering uses semantic comparison, not lexicographic", () => {
    // 0.0.10 > 0.0.2 semantically; sort check must accept this order.
    const e = entry({
      currentVersion: "0.0.10",
      versions: [v("0.0.2"), v("0.0.10")],
    })
    expect(detectSelfConsistencyIssues([e])).toEqual([])
  })
})
