import {
  composioConfigFromEnv,
  ensureAuthConfig,
  loadComposioCatalog,
  publishProviderMcp,
  renConfigFromEnv,
} from "@/lib/composio"
import { log } from "@/lib/log"

type SyncOptions = { dryRun: boolean }

// Provisions a managed Composio auth config per toolkit (via the Composio API, keyed off
// COMPOSIO_API_KEY) and publishes one stable `mcp_provider` MCP row per toolkit to the Ren
// registry as the publisher org. Idempotent — safe to re-run. The auth-config id is
// deployment-specific, so it is resolved here at run time rather than committed to the catalog.
export async function runComposioSyncCommand(opts: SyncOptions): Promise<void> {
  log.header("composio-sync")

  const catalog = await loadComposioCatalog()
  if (catalog.length === 0) {
    log.step("composio catalog is empty — nothing to sync")
    return
  }

  const composio = composioConfigFromEnv()

  const provisioned: { entry: (typeof catalog)[number]; authConfigId: string }[] = []
  for (const entry of catalog) {
    const authConfigId = await ensureAuthConfig(composio, entry.toolkit)
    provisioned.push({ entry, authConfigId })
    log.ok(`auth config ready: ${entry.toolkit} → ${authConfigId}`)
  }

  if (opts.dryRun) {
    log.step(`dry run — resolved ${provisioned.length} auth config(s), skipping publish`)
    return
  }

  const ren = renConfigFromEnv()
  for (const { entry, authConfigId } of provisioned) {
    const { created } = await publishProviderMcp(ren, composio, entry, authConfigId)
    log.ok(`mcp: ${created ? "created + published" : "updated"} ${entry.slug}`)
  }

  log.ok(`synced ${provisioned.length} composio mcp(s)`)
}
