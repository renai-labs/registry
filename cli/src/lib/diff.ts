import { readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, relative } from "node:path"
import { readFile } from "node:fs/promises"

export type DirDiff = {
  added: string[]
  removed: string[]
  modified: string[]
}

async function listFiles(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!existsSync(root)) return out
  const stack: string[] = [root]
  while (stack.length) {
    const dir = stack.pop()!
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile()) out.set(relative(root, full), full)
    }
  }
  return out
}

async function bytesEqual(a: string, b: string): Promise<boolean> {
  const [bufA, bufB] = await Promise.all([readFile(a), readFile(b)])
  if (bufA.length !== bufB.length) return false
  return bufA.equals(bufB)
}

export async function diffDirs(committed: string, scratch: string): Promise<DirDiff> {
  const [c, s] = await Promise.all([listFiles(committed), listFiles(scratch)])
  const added: string[] = []
  const removed: string[] = []
  const modified: string[] = []
  for (const [rel, abs] of s.entries()) {
    const other = c.get(rel)
    if (!other) added.push(rel)
    else if (!(await bytesEqual(abs, other))) modified.push(rel)
  }
  for (const rel of c.keys()) {
    if (!s.has(rel)) removed.push(rel)
  }
  return { added: added.sort(), removed: removed.sort(), modified: modified.sort() }
}

export async function diffFiles(committed: string, scratch: string): Promise<"equal" | "missing" | "different"> {
  if (!existsSync(scratch)) return "missing"
  if (!existsSync(committed)) return "different"
  return (await bytesEqual(committed, scratch)) ? "equal" : "different"
}
