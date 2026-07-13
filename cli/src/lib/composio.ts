import { Composio } from "@composio/core"

const BASE_URL = process.env.COMPOSIO_BASE_URL ?? "https://backend.composio.dev"

let cached: Composio | null = null

export function composioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY)
}

function client(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) throw new Error("COMPOSIO_API_KEY is not set")
  if (!cached) cached = new Composio({ apiKey, baseURL: BASE_URL })
  return cached
}

const memo = new Map<string, string>()

// Provider-backed MCPs never hardcode an auth-config id: it is resolved at publish
// time against whichever Composio account owns COMPOSIO_API_KEY, so the same
// registry entry is correct in every environment. Mirrors the API's ensureAuthConfig.
export async function ensureAuthConfigId(toolkit: string): Promise<string> {
  const hit = memo.get(toolkit)
  if (hit) return hit
  const c = client()
  const { items } = await c.authConfigs.list({ toolkit })
  const existing = items.find((a) => a.toolkit.slug === toolkit)
  const id = existing ? existing.id : (await c.authConfigs.create(toolkit, { type: "use_composio_managed_auth" })).id
  memo.set(toolkit, id)
  return id
}
