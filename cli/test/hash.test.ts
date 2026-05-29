import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { hashFromEntries, hashTree, isIgnoredRelPath, normalize } from "@/lib/hash"

describe("normalize", () => {
  test("leaves LF-only content untouched", () => {
    const buf = Buffer.from("a\nb\nc\n")
    expect(normalize(buf)).toBe(buf)
  })

  test("converts CRLF to LF", () => {
    const buf = Buffer.from("a\r\nb\r\nc\r\n")
    expect(normalize(buf).toString("utf8")).toBe("a\nb\nc\n")
  })

  test("converts bare CR to LF", () => {
    const buf = Buffer.from("a\rb\rc\r")
    expect(normalize(buf).toString("utf8")).toBe("a\nb\nc\n")
  })
})

describe("isIgnoredRelPath", () => {
  test.each([
    [".gitkeep", true],
    [".DS_Store", true],
    ["node_modules/foo", true],
    [".hidden/file.md", true],
    ["SKILL.md", false],
    ["references/workflow.md", false],
    ["scripts/build.sh", false],
  ])("%s → ignored=%p", (path, expected) => {
    expect(isIgnoredRelPath(path)).toBe(expected)
  })
})

describe("hashTree + hashFromEntries", () => {
  let dirA: string
  let dirB: string
  let dirC: string

  beforeAll(async () => {
    dirA = await mkdtemp(join(tmpdir(), "hash-A-"))
    dirB = await mkdtemp(join(tmpdir(), "hash-B-"))
    dirC = await mkdtemp(join(tmpdir(), "hash-C-"))

    // dirA: simple two-file tree
    await writeFile(join(dirA, "SKILL.md"), "alpha\n")
    await mkdir(join(dirA, "scripts"), { recursive: true })
    await writeFile(join(dirA, "scripts", "build.sh"), "echo hi\n")

    // dirB: identical content to dirA, written in different order/path
    await mkdir(join(dirB, "scripts"), { recursive: true })
    await writeFile(join(dirB, "scripts", "build.sh"), "echo hi\n")
    await writeFile(join(dirB, "SKILL.md"), "alpha\n")

    // dirC: dirA + a stray dotfile (should be ignored)
    await writeFile(join(dirC, "SKILL.md"), "alpha\n")
    await mkdir(join(dirC, "scripts"), { recursive: true })
    await writeFile(join(dirC, "scripts", "build.sh"), "echo hi\n")
    await writeFile(join(dirC, ".DS_Store"), "noise")
    await writeFile(join(dirC, ".gitkeep"), "")
  })

  afterAll(async () => {
    await rm(dirA, { recursive: true, force: true })
    await rm(dirB, { recursive: true, force: true })
    await rm(dirC, { recursive: true, force: true })
  })

  test("digest is stable for identical content regardless of write order", async () => {
    const a = await hashTree(dirA)
    const b = await hashTree(dirB)
    expect(a).toBe(b)
  })

  test("ignores dotfiles and .DS_Store", async () => {
    const a = await hashTree(dirA)
    const c = await hashTree(dirC)
    expect(a).toBe(c)
  })

  test("digest changes on content edit", async () => {
    const a = await hashTree(dirA)
    await writeFile(join(dirA, "SKILL.md"), "alpha-modified\n")
    const a2 = await hashTree(dirA)
    expect(a2).not.toBe(a)
  })

  test("hashTree and hashFromEntries produce identical digests for identical content", async () => {
    const fromTree = await hashTree(dirB)
    const entries = [
      { relPath: "SKILL.md", buf: Buffer.from("alpha\n") },
      { relPath: "scripts/build.sh", buf: Buffer.from("echo hi\n") },
    ]
    expect(hashFromEntries(entries)).toBe(fromTree)
  })

  test("hashFromEntries normalizes CRLF the same way", () => {
    const lf = hashFromEntries([{ relPath: "f", buf: Buffer.from("a\nb\n") }])
    const crlf = hashFromEntries([{ relPath: "f", buf: Buffer.from("a\r\nb\r\n") }])
    expect(lf).toBe(crlf)
  })

  test("hashFromEntries respects path order via internal sort", () => {
    const forward = hashFromEntries([
      { relPath: "a", buf: Buffer.from("1") },
      { relPath: "b", buf: Buffer.from("2") },
    ])
    const reversed = hashFromEntries([
      { relPath: "b", buf: Buffer.from("2") },
      { relPath: "a", buf: Buffer.from("1") },
    ])
    expect(forward).toBe(reversed)
  })

  test("throws on non-directory input", async () => {
    await expect(hashTree(join(tmpdir(), "does-not-exist-" + Math.random()))).rejects.toThrow()
  })
})
