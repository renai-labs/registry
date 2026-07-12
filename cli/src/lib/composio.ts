import { z } from "zod"
import { Composio } from "@composio/core"
import { Slug } from "@renai-labs/registry-schemas"
import { PATHS } from "./paths"
import { readJsonOr } from "./json"

export const ComposioMcpEntry = z.object({
  slug: Slug,
  toolkit: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
})
export type ComposioMcpEntry = z.infer<typeof ComposioMcpEntry>

export const ComposioMcpsRegistry = z.array(ComposioMcpEntry)

export async function loadComposioCatalog(): Promise<ComposioMcpEntry[]> {
  const entries = ComposioMcpsRegistry.parse(await readJsonOr<unknown>(PATHS.composioMcpsJson, []))
  const sorted = [...entries].sort((a, b) => a.slug.localeCompare(b.slug))
  return sorted
}

export type ComposioConfig = { apiKey: string; baseUrl: string }

export function composioConfigFromEnv(): ComposioConfig {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) throw new Error("COMPOSIO_API_KEY is not set")
  return { apiKey, baseUrl: process.env.COMPOSIO_BASE_URL ?? "https://backend.composio.dev" }
}

export async function ensureAuthConfig(cfg: ComposioConfig, toolkit: string): Promise<string> {
  const client = new Composio({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl })
  const { items } = await client.authConfigs.list({ toolkit })
  const existing = items.find((a) => a.toolkit.slug === toolkit)
  if (existing) return existing.id
  const created = await client.authConfigs.create(toolkit, { type: "use_composio_managed_auth" })
  return created.id
}

export type RenConfig = { baseUrl: string; token: string }

export function renConfigFromEnv(): RenConfig {
  const token = process.env.REN_PUBLISHER_PAT
  if (!token) throw new Error("REN_PUBLISHER_PAT is not set")
  return { baseUrl: process.env.REN_REGISTRY_URL ?? "https://api.renai.build", token }
}

const McpRef = z.object({ id: z.string() })

async function renFetch(cfg: RenConfig, path: string, init?: RequestInit): Promise<Response> {
  return fetch(new URL(path, cfg.baseUrl), {
    ...init,
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json", ...init?.headers },
  })
}

// The Ren API models the mcp_provider auth variant; the published @renai-labs/sdk still lags, so
// this command talks to the API directly rather than through the typed client.
function providerBody(cfg: ComposioConfig, entry: ComposioMcpEntry, authConfigId: string) {
  return {
    slug: entry.slug,
    name: entry.name,
    description: entry.description,
    type: "remote" as const,
    transport: "streamable-http" as const,
    mcpServerUrl: cfg.baseUrl,
    auth: "mcp_provider" as const,
    authConfig: { type: "mcp_provider" as const, provider: "composio" as const, toolkit: entry.toolkit, authConfigId },
  }
}

async function getMcpIdBySlug(cfg: RenConfig, slug: string): Promise<string | null> {
  const res = await renFetch(cfg, `/api/mcps/slug/${slug}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`get mcp ${slug} failed: ${res.status} ${await res.text()}`)
  return McpRef.parse(await res.json()).id
}

/** Create or update the published mcp_provider row for a toolkit. Idempotent by slug. */
export async function publishProviderMcp(
  ren: RenConfig,
  composio: ComposioConfig,
  entry: ComposioMcpEntry,
  authConfigId: string,
): Promise<{ id: string; created: boolean }> {
  const body = providerBody(composio, entry, authConfigId)
  const existingId = await getMcpIdBySlug(ren, entry.slug)

  if (existingId) {
    const res = await renFetch(ren, `/api/mcps/${existingId}`, { method: "PATCH", body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`update mcp ${entry.slug} failed: ${res.status} ${await res.text()}`)
    return { id: existingId, created: false }
  }

  const createRes = await renFetch(ren, "/api/mcps", { method: "POST", body: JSON.stringify(body) })
  if (!createRes.ok) throw new Error(`create mcp ${entry.slug} failed: ${createRes.status} ${await createRes.text()}`)
  const { id } = McpRef.parse(await createRes.json())

  const pubRes = await renFetch(ren, `/api/mcps/${id}/publish`, { method: "POST" })
  if (!pubRes.ok) throw new Error(`publish mcp ${entry.slug} failed: ${pubRes.status} ${await pubRes.text()}`)
  return { id, created: true }
}
