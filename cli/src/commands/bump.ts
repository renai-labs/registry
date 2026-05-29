import { setPluginMajorMarker } from "@/lib/snapshot"
import { log } from "@/lib/log"

export async function runBumpPluginMajor(): Promise<void> {
  log.header("bump --plugin-major")
  await setPluginMajorMarker("explicit plugin-major bump requested")
  log.ok("marker written — next `build` will major-bump the plugin")
}
