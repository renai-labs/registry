import { describe, expect, test } from "bun:test"
import type { SkillEntry } from "@renai-labs/registry-schemas"
import { bumpVersion, findVersion, highestVersion } from "@/lib/snapshot"

describe("bumpVersion", () => {
  test.each([
    ["0.0.0", "patch", "0.0.1"],
    ["0.0.1", "patch", "0.0.2"],
    ["0.0.1", "minor", "0.1.0"],
    ["0.0.1", "major", "1.0.0"],
    ["1.2.3", "patch", "1.2.4"],
    ["1.2.3", "minor", "1.3.0"],
    ["1.2.3", "major", "2.0.0"],
    ["10.99.99", "patch", "10.99.100"],
  ] as const)("bump %p by %p → %p", (current, bump, expected) => {
    expect(bumpVersion(current, bump)).toBe(expected)
  })

  test("throws on invalid semver input", () => {
    expect(() => bumpVersion("not-a-version", "patch")).toThrow()
  })
})

function entry(versions: string[]): SkillEntry {
  return {
    slug: "x",
    name: "x",
    description: "x",
    currentVersion: versions[versions.length - 1]!,
    contentHash: "h",
    versions: versions.map((v) => ({ version: v, gitRef: null, publishedAt: null, contentHash: "h" })),
  }
}

describe("highestVersion", () => {
  test("returns the entry with the highest semver", () => {
    const e = entry(["0.0.1", "0.0.10", "0.1.0", "1.0.0"])
    expect(highestVersion(e)?.version).toBe("1.0.0")
  })

  test("respects semantic ordering, not lexicographic", () => {
    const e = entry(["0.0.2", "0.0.10"])
    expect(highestVersion(e)?.version).toBe("0.0.10")
  })

  test("handles a single version", () => {
    const e = entry(["0.0.1"])
    expect(highestVersion(e)?.version).toBe("0.0.1")
  })
})

describe("findVersion", () => {
  test("finds an existing version by string match", () => {
    const e = entry(["0.0.1", "0.0.2"])
    expect(findVersion(e, "0.0.1")?.version).toBe("0.0.1")
  })

  test("returns undefined for unknown versions", () => {
    const e = entry(["0.0.1"])
    expect(findVersion(e, "9.9.9")).toBeUndefined()
  })
})
