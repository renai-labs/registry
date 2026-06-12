#!/usr/bin/env bun
// bun run scripts/diff.ts [topology.json] [--live <file>|-]
// With no --live, shells out to `ren topology get --output json`.

import { resolve } from "node:path"

const args = process.argv.slice(2)
const opt = (n: string) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : undefined
}
const liveArg = opt("--live")
const draftPath = resolve(args.find((a) => !a.startsWith("--") && a !== liveArg) ?? "topology.json")

const draft = await readJson(draftPath)
const live = await readLive(liveArg)

const COLLECTIONS: { key: keyof Spec; fields: string[] }[] = [
  { key: "agents", fields: ["name", "model", "skills", "mcps"] },
  { key: "mcps", fields: ["name", "registrySlug", "remoteUrl", "credential"] },
  { key: "skills", fields: ["source"] },
  { key: "credentials", fields: ["provider", "vault"] },
  { key: "vaults", fields: ["name", "scope", "attachedPods"] },
  { key: "fileStores", fields: ["name", "scope"] },
  { key: "memoryStores", fields: ["name", "scope"] },
  { key: "pods", fields: ["name", "scope", "vaults"] },
  { key: "projects", fields: ["name", "pod", "primaryAgent", "subAgents", "fileStores", "memoryStores"] },
  { key: "triggers", fields: ["project", "schedule", "inputMessage", "enabled"] },
]

type EntityDiff = { collection: string; toBuild: string[]; extra: string[]; changed: { slug: string; fields: string[] }[] }

const diffs: EntityDiff[] = COLLECTIONS.map(({ key, fields }) => {
  const d = bySlug((draft[key] as Entity[]) ?? [])
  const l = bySlug((live[key] as Entity[]) ?? [])
  const toBuild = [...d.keys()].filter((s) => !l.has(s))
  const extra = [...l.keys()].filter((s) => !d.has(s))
  const changed: { slug: string; fields: string[] }[] = []
  for (const [slug, de] of d) {
    const le = l.get(slug)
    if (!le) continue
    const diffFields = fields.filter((f) => !eq(de[f], le[f]))
    if (diffFields.length) changed.push({ slug, fields: diffFields })
  }
  return { collection: key, toBuild, extra, changed }
})

const requirements = evalRequirements(draft, live)

const pending = diffs.filter((d) => d.toBuild.length || d.extra.length || d.changed.length)
if (!pending.length) console.log("✓ live matches draft (all collections)")
for (const d of pending) {
  console.log(`\n# ${d.collection}`)
  if (d.toBuild.length) console.log(`  to build : ${d.toBuild.join(", ")}`)
  if (d.extra.length) console.log(`  extra    : ${d.extra.join(", ")} (in live, not draft)`)
  for (const c of d.changed) console.log(`  changed  : ${c.slug} → ${c.fields.join(", ")}`)
}

const unmet = requirements.filter((r) => r.status !== "pass")
console.log(`\n# requirements  (${requirements.length - unmet.length}/${requirements.length} pass)`)
for (const r of requirements) {
  const mark = r.status === "pass" ? "✓" : r.status === "blocked" ? "⊘" : "✗"
  console.log(`  ${mark} [${r.project}] ${r.must}`)
  if (r.status !== "pass" && r.verify) console.log(`      verify: ${r.verify}`)
  if (r.blockedBy) console.log(`      blockedBy: ${r.blockedBy}`)
}

console.log("\n--- machine ---")
console.log(JSON.stringify({ entities: pending, requirements: unmet }, null, 2))

type Entity = Record<string, unknown> & { slug: string }
type Requirement = {
  id: string
  kind: string
  must: string
  agent?: string
  mcp?: string
  skill?: string
  credential?: string
  trigger?: string
  vault?: string
  store?: string
  channel?: string
  blocking?: boolean
  verify?: string
  blockedBy?: string
}
type Spec = {
  agents?: Entity[]
  mcps?: Entity[]
  skills?: Entity[]
  credentials?: Entity[]
  vaults?: Entity[]
  fileStores?: Entity[]
  memoryStores?: Entity[]
  pods?: Entity[]
  projects?: (Entity & {
    pod?: string
    primaryAgent?: string
    subAgents?: string[]
    fileStores?: string[]
    memoryStores?: string[]
    requirements?: Requirement[]
  })[]
  triggers?: (Entity & { project?: string })[]
  slack?: { channels?: { name: string; project?: string | null }[] }
}

async function readJson(path: string): Promise<Spec> {
  const f = Bun.file(path)
  if (!(await f.exists())) {
    console.error(`not found: ${path}`)
    process.exit(1)
  }
  return JSON.parse(await f.text()) as Spec
}

async function readLive(arg: string | undefined): Promise<Spec> {
  if (arg === "-") return JSON.parse(await Bun.stdin.text()) as Spec
  if (arg) return readJson(resolve(arg))
  const proc = Bun.spawn(["ren", "topology", "get", "--output", "json"], { stdout: "pipe", stderr: "pipe" })
  const [out, code] = [await new Response(proc.stdout).text(), await proc.exited]
  if (code !== 0) {
    console.error(`\`ren topology get\` failed (exit ${code}). Pass --live <file> or pipe with --live -.`)
    process.exit(1)
  }
  return JSON.parse(out) as Spec
}

function bySlug(xs: Entity[]): Map<string, Entity> {
  return new Map(xs.map((x) => [x.slug, x]))
}

function eq(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    const sa = [...a].map(String).sort()
    const sb = [...b].map(String).sort()
    return sa.every((v, i) => v === sb[i])
  }
  return a === b || (a == null && b == null)
}

function evalRequirements(draft: Spec, live: Spec): (Requirement & { project: string; status: string })[] {
  const liveAgents = bySlug(live.agents ?? [])
  const liveCreds = bySlug(live.credentials ?? [])
  const liveVaults = bySlug(live.vaults ?? [])
  const liveProjects = bySlug(live.projects ?? [])
  const liveTriggers = bySlug(live.triggers ?? [])
  const out: (Requirement & { project: string; status: string })[] = []

  const has = (arr: unknown, v?: string) => Array.isArray(arr) && !!v && arr.map(String).includes(v)

  for (const project of draft.projects ?? []) {
    const lp = liveProjects.get(project.slug)
    for (const r of project.requirements ?? []) {
      let status: string
      if (r.blockedBy) status = "blocked"
      else
        switch (r.kind) {
          case "agent_attached":
            status = lp && (lp.primaryAgent === r.agent || has(lp.subAgents, r.agent)) ? "pass" : "fail"
            break
          case "skill_attached":
            status = has(liveAgents.get(r.agent ?? "")?.skills, r.skill) ? "pass" : "fail"
            break
          case "mcp_wired":
            status = has(liveAgents.get(r.agent ?? "")?.mcps, r.mcp) ? "pass" : "fail"
            break
          case "credential_present":
            status = !!r.credential && liveCreds.has(r.credential) ? "pass" : "fail"
            break
          case "vault_attached":
            status = has(liveVaults.get(r.vault ?? "")?.attachedPods, lp?.pod as string) ? "pass" : "fail"
            break
          case "trigger_configured":
            status = !!r.trigger && liveTriggers.has(r.trigger) ? "pass" : "fail"
            break
          case "file_store_attached":
            status = has(lp?.fileStores, r.store) ? "pass" : "fail"
            break
          case "memory_store_attached":
            status = has(lp?.memoryStores, r.store) ? "pass" : "fail"
            break
          case "slack_mapped":
            status = (live.slack?.channels ?? []).some((c) => c.name === r.channel && c.project === project.slug)
              ? "pass"
              : "fail"
            break
          default:
            status = "manual"
        }
      out.push({ ...r, project: project.slug, status })
    }
  }
  return out
}
