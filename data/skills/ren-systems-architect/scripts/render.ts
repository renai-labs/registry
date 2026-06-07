#!/usr/bin/env bun
// bun run scripts/render.ts [topology.json] [--out <file>] [--no-open]

import { join, resolve } from "node:path"

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const here = import.meta.dir
const draftPath = resolve(args.find((a) => !a.startsWith("--") && a !== opt("--out")) ?? "topology.json")
const outPath = resolve(opt("--out") ?? "/tmp/ren-canvas.html")
const canvasAsset = join(here, "..", "assets", "canvas.html")

const draftFile = Bun.file(draftPath)
if (!(await draftFile.exists())) {
  console.error(`draft not found: ${draftPath}`)
  process.exit(1)
}

let topology: unknown
try {
  topology = JSON.parse(await draftFile.text())
} catch (e) {
  console.error(`draft is not valid JSON: ${(e as Error).message}`)
  process.exit(1)
}

const problems = validate(topology as Spec)
if (problems.length) {
  console.error("draft has unresolved references:")
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

const html = await Bun.file(canvasAsset).text()
const injected = injectTopology(html, topology)
await Bun.write(outPath, injected)
console.log(`rendered → ${outPath}`)

if (!flag("--no-open")) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open"
  try {
    const proc = Bun.spawn([opener, outPath], { stdout: "ignore", stderr: "ignore" })
    await proc.exited
  } catch {
    console.log(`(couldn't open a browser here — open ${outPath} manually)`)
  }
}

type Spec = {
  agents?: { slug: string; skills?: string[]; mcps?: string[] }[]
  mcps?: { slug: string }[]
  skills?: { slug: string }[]
  vaults?: { slug: string; attachedPods?: string[] }[]
  credentials?: { slug: string; vault?: string }[]
  fileStores?: { slug: string }[]
  memoryStores?: { slug: string }[]
  pods?: { slug: string }[]
  projects?: {
    slug: string
    pod?: string
    primaryAgent?: string
    subAgents?: string[]
    fileStores?: string[]
    memoryStores?: string[]
  }[]
  triggers?: { slug: string; project?: string }[]
  slack?: { channels?: { project?: string | null }[] }
  github?: { repos?: { project?: string }[] }
}

function validate(s: Spec): string[] {
  const out: string[] = []
  if (!Array.isArray(s.agents)) out.push("missing `agents` array")
  if (!Array.isArray(s.pods)) out.push("missing `pods` array")
  if (!Array.isArray(s.projects)) out.push("missing `projects` array")
  const slugs = (xs?: { slug: string }[]) => new Set((xs ?? []).map((x) => x.slug))
  const pods = slugs(s.pods)
  const agents = slugs(s.agents)
  const vaults = slugs(s.vaults)
  const fileStores = slugs(s.fileStores)
  const memoryStores = slugs(s.memoryStores)
  const skills = slugs(s.skills)
  const mcps = slugs(s.mcps)
  const check = (ref: string | undefined | null, set: Set<string>, where: string) => {
    if (ref && !set.has(ref)) out.push(`${where} → unknown slug "${ref}"`)
  }
  for (const a of s.agents ?? []) {
    for (const sk of a.skills ?? []) check(sk, skills, `agent "${a.slug}".skills`)
    for (const m of a.mcps ?? []) check(m, mcps, `agent "${a.slug}".mcps`)
  }
  for (const p of s.projects ?? []) {
    check(p.pod, pods, `project "${p.slug}".pod`)
    check(p.primaryAgent, agents, `project "${p.slug}".primaryAgent`)
    for (const a of p.subAgents ?? []) check(a, agents, `project "${p.slug}".subAgents`)
    for (const f of p.fileStores ?? []) check(f, fileStores, `project "${p.slug}".fileStores`)
    for (const mm of p.memoryStores ?? []) check(mm, memoryStores, `project "${p.slug}".memoryStores`)
  }
  for (const v of s.vaults ?? []) for (const pod of v.attachedPods ?? []) check(pod, pods, `vault "${v.slug}".attachedPods`)
  for (const c of s.credentials ?? []) check(c.vault, vaults, `credential "${c.slug}".vault`)
  const projects = slugs(s.projects)
  for (const t of s.triggers ?? []) check(t.project, projects, `trigger "${t.slug}".project`)
  for (const ch of s.slack?.channels ?? []) check(ch.project ?? undefined, projects, `slack channel`)
  for (const r of s.github?.repos ?? []) check(r.project, projects, `github repo`)
  return out
}

function injectTopology(html: string, topology: unknown): string {
  const json = JSON.stringify(topology).replace(/<\/script/gi, "<\\/script")
  const re = /(<script[^>]*id="ren-topology"[^>]*>)([\s\S]*?)(<\/script>)/i
  if (!re.test(html)) throw new Error("canvas.html has no #ren-topology block — rebuild the asset")
  return html.replace(re, `$1\n${json}\n$3`)
}
