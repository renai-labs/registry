import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import { join, relative } from "node:path"

// sorted + CRLF-normalized + path-prefixed so the sha256 digest is stable across machines and file orderings

const IGNORE = new Set([".DS_Store", "node_modules", ".git"])

// Whether a relative-path segment should be skipped by both the working-tree
// hash (hashTree) and the git-blob hash (hashFromEntries via gitLsTree). Keeps
// the two paths in agreement: dotfiles never contribute to the digest.

export function isIgnoredPathSegment(name: string): boolean {
  return IGNORE.has(name) || name.startsWith(".")
}

export function isIgnoredRelPath(relPath: string): boolean {
  return relPath.split("/").some(isIgnoredPathSegment)
}

async function walk(dir: string, root: string, acc: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (IGNORE.has(entry.name) || entry.name.startsWith(".")) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, root, acc)
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      acc.push(relative(root, full))
    }
  }
}

export function normalize(buf: Buffer): Buffer {
  // Normalize CRLF → LF so checked-out content on Windows hashes the same as
  // on Unix. Binary files unaffected in practice (no \r\n sequences).
  const s = buf.toString("utf8")
  if (!s.includes("\r")) return buf
  return Buffer.from(s.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8")
}

export async function hashTree(dir: string): Promise<string> {
  const s = await stat(dir)
  if (!s.isDirectory()) throw new Error(`hashTree: not a directory: ${dir}`)

  const files: string[] = []
  await walk(dir, dir, files)
  files.sort()

  const hasher = createHash("sha256")
  for (const rel of files) {
    const buf = normalize(await readFile(join(dir, rel)))
    const fileHash = createHash("sha256").update(buf).digest("hex")
    hasher.update(rel)
    hasher.update("\0")
    hasher.update(fileHash)
    hasher.update("\n")
  }
  return hasher.digest("hex")
}

export function hashString(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex")
}

// Same digest as hashTree, but takes pre-loaded {relPath, buf} pairs. Used
// by the frozen-version integrity check where bytes come from `git cat-file`
// instead of the working tree.

export function hashFromEntries(entries: { relPath: string; buf: Buffer }[]): string {
  const sorted = [...entries].sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0))
  const hasher = createHash("sha256")
  for (const e of sorted) {
    const norm = normalize(e.buf)
    const fileHash = createHash("sha256").update(norm).digest("hex")
    hasher.update(e.relPath)
    hasher.update("\0")
    hasher.update(fileHash)
    hasher.update("\n")
  }
  return hasher.digest("hex")
}
