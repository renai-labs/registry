import { spawnSync } from "node:child_process"
import { REPO_ROOT } from "./paths"

function run(args: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" })
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status ?? 1 }
}

export function gitHeadSha(): string {
  const r = run(["rev-parse", "HEAD"])
  if (r.status !== 0) throw new Error(`git rev-parse failed: ${r.stderr}`)
  return r.stdout.trim()
}

export function gitAdd(paths: string[]): void {
  if (!paths.length) return
  const r = run(["add", "--", ...paths])
  if (r.status !== 0) throw new Error(`git add failed: ${r.stderr}`)
}

export function gitHasStagedChanges(): boolean {
  // `diff --cached --quiet` exits non-zero when the index differs from HEAD.
  return run(["diff", "--cached", "--quiet"]).status !== 0
}

export function gitCommit(message: string): string {
  const r = run(["commit", "-m", message])
  if (r.status !== 0) throw new Error(`git commit failed: ${r.stderr || r.stdout}`)
  return gitHeadSha()
}

export function gitLsTree(ref: string, path: string): { relPath: string; oid: string }[] {
  const r = run(["ls-tree", "-r", "--full-tree", ref, "--", path])
  if (r.status !== 0) throw new Error(`git ls-tree ${ref}:${path} failed: ${r.stderr}`)
  const rows: { relPath: string; oid: string }[] = []
  for (const line of r.stdout.split("\n")) {
    if (!line) continue
    // ls-tree format: "<mode> <type> <oid>\t<path>"
    const tab = line.indexOf("\t")
    if (tab < 0) continue
    const meta = line.slice(0, tab).split(" ")
    const oid = meta[2]
    const fullPath = line.slice(tab + 1)
    if (!oid) continue
    rows.push({ relPath: fullPath.startsWith(path + "/") ? fullPath.slice(path.length + 1) : fullPath, oid })
  }
  return rows
}

export function gitRefExists(ref: string): boolean {
  const r = run(["rev-parse", "--verify", ref])
  return r.status === 0
}

export function gitShowFile(ref: string, path: string): string | null {
  const r = run(["show", `${ref}:${path}`])
  if (r.status !== 0) return null
  return r.stdout
}

export function gitMergeBase(a: string, b: string): string | null {
  const r = run(["merge-base", a, b])
  if (r.status !== 0) return null
  return r.stdout.trim() || null
}

export function gitCatBlob(oid: string): Buffer {
  // No `encoding` option here (unlike run()) so stdout comes back as raw bytes.
  const r = spawnSync("git", ["cat-file", "blob", oid], { cwd: REPO_ROOT })
  if (r.status !== 0) {
    const stderr = r.stderr ? r.stderr.toString() : ""
    throw new Error(`git cat-file blob ${oid} failed: ${stderr}`)
  }
  return r.stdout as Buffer
}
