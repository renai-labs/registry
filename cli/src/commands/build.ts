import { build, BuildError } from "@/lib/build"
import { log } from "@/lib/log"

export async function runBuildCommand(): Promise<void> {
  log.header("build")
  try {
    await build()
  } catch (e) {
    if (e instanceof BuildError) {
      for (const p of e.problems) log.err(p)
      process.exit(1)
    }
    throw e
  }
}
