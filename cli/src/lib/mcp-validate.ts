import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { McpsRegistry, type McpEntry } from "@renai-labs/registry-schemas"
import { resolveBaseRef } from "./build"
import { gitShowFile } from "./git"
import { loadMcpsRegistry } from "./snapshot"
import { PATHS, REPO_ROOT } from "./paths"

const VALIDATE_SCRIPT = join(PATHS.dataSkills, "ren-mcp-dev", "scripts", "validate-mcp.js")

function isValidatable(url: string | null): url is string {
  if (!url) return false
  try {
    return !new URL(url).hostname.endsWith(".invalid")
  } catch {
    return false
  }
}

export type McpChange = { entry: McpEntry; reason: "added" | "url-changed" | "tools-changed" }

export async function detectChangedMcps(baseRef?: string): Promise<{ changes: McpChange[]; usedBaseRef: string | null }> {
  const ref = resolveBaseRef(baseRef)
  if (!ref) return { changes: [], usedBaseRef: null }

  const baseRaw = gitShowFile(ref, "data/mcp_servers.json")
  if (baseRaw === null) return { changes: [], usedBaseRef: null }

  let baseEntries: McpEntry[]
  try {
    baseEntries = McpsRegistry.parse(JSON.parse(baseRaw))
  } catch {
    return { changes: [], usedBaseRef: null }
  }
  const baseBySlug = new Map(baseEntries.map((e) => [e.slug, e]))

  const changes: McpChange[] = []
  for (const entry of await loadMcpsRegistry()) {
    if (!isValidatable(entry.mcpServerUrl)) continue
    const prev = baseBySlug.get(entry.slug)
    if (!prev) {
      changes.push({ entry, reason: "added" })
    } else if (prev.mcpServerUrl !== entry.mcpServerUrl) {
      changes.push({ entry, reason: "url-changed" })
    } else if (prev.tools.join(" ") !== entry.tools.join(" ")) {
      changes.push({ entry, reason: "tools-changed" })
    }
  }
  return { changes, usedBaseRef: ref }
}

export type McpValidation = { slug: string; compatible: boolean; detail: string }

function validateOne(entry: McpEntry): McpValidation {
  const args = [VALIDATE_SCRIPT, entry.mcpServerUrl as string, "--json", "--auth", entry.auth]
  if (entry.tools.length) args.push("--expect-tools", entry.tools.join(","))

  const r = spawnSync("node", args, { cwd: REPO_ROOT, encoding: "utf8", timeout: 60_000 })
  if (r.error) return { slug: entry.slug, compatible: false, detail: `validator failed to run: ${r.error.message}` }

  let report: { compatible?: boolean; checks?: Record<string, { ok: boolean | null; detail: string }>; drift?: { tools?: { missing: string[]; extra: string[] } } }
  try {
    report = JSON.parse(r.stdout)
  } catch {
    return { slug: entry.slug, compatible: false, detail: `validator produced no JSON (exit ${r.status})` }
  }

  const failed = Object.entries(report.checks ?? {})
    .filter(([, c]) => c.ok === false)
    .map(([k, c]) => `${k}: ${c.detail}`)
  const missing = report.drift?.tools?.missing ?? []
  if (missing.length) failed.push(`registry tools not served: ${missing.join(", ")}`)

  return {
    slug: entry.slug,
    compatible: !!report.compatible && missing.length === 0,
    detail: failed.length ? failed.join("; ") : "Ren-compatible",
  }
}

export async function validateChangedMcps(baseRef?: string): Promise<{ results: McpValidation[]; usedBaseRef: string | null }> {
  const { changes, usedBaseRef } = await detectChangedMcps(baseRef)
  const results = changes.map((c) => validateOne(c.entry))
  return { results, usedBaseRef }
}
