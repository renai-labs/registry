import semver from "semver"
import { createRenClient, pat } from "@renai-labs/sdk"
import type { RenClient } from "@renai-labs/sdk"
import { build, BuildError } from "@/lib/build"
import { loadAgentsRegistry, loadMcpsRegistry, loadSkillsRegistry, saveSkillsRegistry } from "@/lib/snapshot"
import { gitAdd, gitCommit, gitHasStagedChanges, gitHeadSha } from "@/lib/git"
import { log } from "@/lib/log"
import type { AgentEntry, AgentVersionEntry, DepRef, McpEntry, SkillEntry, SkillVersionEntry } from "@renai-labs/registry-schemas"

const REGISTRY_URL = process.env.REN_REGISTRY_URL ?? "https://api.renai.build"
const REPO_URL = process.env.REN_REGISTRY_REPO_URL ?? "https://github.com/renai-labs/skills"

// Only registry artifacts get staged into the publish commit whose SHA becomes
// every frozen gitRef — never the maintainer's unrelated working-tree edits.
const REGISTRY_PATHS = ["data", "skills", "plugins", "skills.sh.json"]

type PublishOptions = { dryRun: boolean }

export const jsonArray = (xs: unknown[] | undefined) => (xs?.length ? JSON.stringify(xs) : undefined)
export const publishedVersions = <T extends { gitRef: string | null; version: string }>(versions: T[]) =>
  versions.filter((v) => v.gitRef !== null).sort((a, b) => semver.compare(a.version, b.version))

export async function runPublishCommand(opts: PublishOptions): Promise<void> {
  log.header("publish")

  try {
    await build()
  } catch (e) {
    if (e instanceof BuildError) {
      for (const p of e.problems) log.err(p)
      process.exit(1)
    }
    throw e
  }

  const skills = await loadSkillsRegistry()
  const pending: { slug: string; version: string }[] = []
  for (const s of skills) {
    for (const v of s.versions) if (v.gitRef === null) pending.push({ slug: s.slug, version: v.version })
  }

  let publishSha: string | null = null
  let freshSkills = skills
  gitAdd(REGISTRY_PATHS)
  if (gitHasStagedChanges()) {
    const summary = pending.length ? pending.map((p) => `${p.slug}@${p.version}`).join(", ") : "build artifacts"
    publishSha = gitCommit(`chore(registry): publish ${summary}`)
    log.ok(`publish commit ${publishSha.slice(0, 7)}: ${summary}`)
  } else if (pending.length) {
    publishSha = gitHeadSha()
    log.step(`no changes to commit; using HEAD ${publishSha.slice(0, 7)}`)
  } else {
    log.step("nothing to publish (no pending versions)")
  }

  if (publishSha && pending.length) {
    const publishedAt = new Date().toISOString()
    freshSkills = skills.map((s) => ({
      ...s,
      versions: s.versions.map((v) => (v.gitRef === null ? { ...v, gitRef: publishSha!, publishedAt } : v)),
    }))
    await saveSkillsRegistry(freshSkills)
    gitAdd(["data/skills.json"])
    const recordSha = gitCommit(`chore(registry): record SHA ${publishSha.slice(0, 7)} for published versions`)
    log.ok(`record commit ${recordSha.slice(0, 7)}`)
  }

  const token = process.env.REN_PUBLISHER_PAT
  if (opts.dryRun || !token) {
    if (!token && !opts.dryRun) log.warn("REN_PUBLISHER_PAT not set — skipping push to registry")
    return
  }

  const client = createRenClient({ baseUrl: REGISTRY_URL, auth: pat(token) })
  const agents = await loadAgentsRegistry()
  const mcps = await loadMcpsRegistry()

  const skillIds = await publishSkills(client, freshSkills)
  const mcpIds = await publishMcps(client, mcps)
  await publishAgents(client, agents, skillIds, mcpIds)

  log.ok(`pushed ${freshSkills.length} skill(s), ${agents.length} agent(s), ${mcps.length} mcp(s)`)
}

export async function publishSkills(client: RenClient, entries: SkillEntry[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const entry of entries) {
    const versions = publishedVersions(entry.versions)
    if (!versions.length) continue

    const sourceFields = (v: SkillVersionEntry) => ({
      source: JSON.stringify({ type: "git", url: REPO_URL, ref: v.gitRef, path: `data/skills/${entry.slug}` }),
      releaseNotes: v.releaseNotes ?? undefined,
      requiredCredentials: jsonArray(v.requiredCredentials),
    })

    const { data: existing } = await client.skill.getBySlug({ path: { slug: entry.slug } })

    let id: string
    if (!existing) {
      const { data: created, error } = await client.skill.create({
        body: {
          name: entry.name,
          description: entry.description,
          icon: entry.icon ?? undefined,
          tags: jsonArray(entry.tags),
          files: [],
          ...sourceFields(versions[0]!),
        },
      })
      if (!created) {
        log.warn(`skill ${entry.slug}: create failed — ${JSON.stringify(error)}`)
        continue
      }
      await client.skill.publish({ path: { id: created.id } })
      id = created.id
      log.ok(`skill: created + published ${entry.slug} v${versions[0]!.version}`)
    } else {
      id = existing.id
      await client.skill.update({
        path: { id },
        body: {
          name: entry.name,
          description: entry.description,
          icon: entry.icon ?? null,
          docUrl: entry.docUrl ?? null,
          websiteMetadata: entry.websiteMetadata ?? null,
          tags: entry.tags ?? [],
        },
      })
      log.step(`skill: updated ${entry.slug}`)
    }
    ids.set(entry.slug, id)

    const { data: present } = await client.skill.version.list({ path: { id } })
    const onServer = new Set((present ?? []).map((v) => v.version))
    const backfill = existing ? versions : versions.slice(1)
    for (const v of backfill) {
      if (onServer.has(v.version)) continue
      const { error } = await client.skill.version.create({
        path: { id },
        body: { version: v.version, files: [], ...sourceFields(v) },
      })
      if (error) log.warn(`skill ${entry.slug} v${v.version}: version create failed — ${JSON.stringify(error)}`)
      else log.ok(`skill: added version ${entry.slug} v${v.version}`)
    }
  }

  return ids
}

export async function publishMcps(client: RenClient, entries: McpEntry[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const entry of entries) {
    const { data: existing } = await client.mcp.getBySlug({ path: { slug: entry.slug } })

    if (!existing) {
      if (!entry.mcpServerUrl) {
        log.warn(`mcp ${entry.slug}: no mcpServerUrl — skipped`)
        continue
      }
      const { data: created, error } = await client.mcp.create({
        body: {
          name: entry.name,
          description: entry.description,
          icon: entry.icon ?? undefined,
          mcpServerUrl: entry.mcpServerUrl,
          docUrl: entry.docUrl ?? undefined,
          transport: entry.transport,
          version: entry.version ?? undefined,
          repository: entry.repository ?? undefined,
          tools: entry.tools,
          prompts: entry.prompts,
          auth: entry.auth,
          authConfig: entry.authConfig ?? undefined,
          tags: entry.useCases,
        },
      })
      if (!created) {
        log.warn(`mcp ${entry.slug}: create failed — ${JSON.stringify(error)}`)
        continue
      }
      await client.mcp.publish({ path: { id: created.id } })
      ids.set(entry.slug, created.id)
      log.ok(`mcp: created + published ${entry.slug}`)
    } else {
      await client.mcp.update({
        path: { id: existing.id },
        body: {
          name: entry.name,
          description: entry.description,
          icon: entry.icon ?? null,
          mcpServerUrl: entry.mcpServerUrl ?? undefined,
          docUrl: entry.docUrl ?? null,
          transport: entry.transport,
          version: entry.version ?? null,
          repository: entry.repository ?? null,
          tools: entry.tools,
          prompts: entry.prompts,
          auth: entry.auth,
          authConfig: entry.authConfig ?? null,
          websiteMetadata: entry.websiteMetadata ?? null,
          tags: entry.useCases,
        },
      })
      ids.set(entry.slug, existing.id)
      log.step(`mcp: updated ${entry.slug}`)
    }
  }

  return ids
}

export function resolveDeps<T>(
  refs: DepRef[] | undefined,
  ids: Map<string, string>,
  agentSlug: string,
  kind: string,
  build: (id: string) => T,
): T[] {
  return (refs ?? []).flatMap((ref) => {
    const slug = typeof ref === "string" ? ref : ref.slug
    const id = ids.get(slug)
    if (!id) {
      log.warn(`agent ${agentSlug}: ${kind} "${slug}" not published — dropping`)
      return []
    }
    return [build(id)]
  })
}

export async function publishAgents(
  client: RenClient,
  entries: AgentEntry[],
  skillIds: Map<string, string>,
  mcpIds: Map<string, string>,
): Promise<void> {
  for (const entry of entries) {
    const { slug, name, icon } = entry.agent
    const tags = entry._meta?.["com.renai/agent-registry"]?.tags ?? []
    const versions = [...entry.versions].sort((a, b) => semver.compare(a.version, b.version))
    if (!versions.length) continue

    const versionBody = (v: AgentVersionEntry) => ({
      version: v.version,
      description: v.description ?? undefined,
      prompt: v.prompt,
      model: v.model ?? null,
      permission: v.permission,
      skills: resolveDeps(v.skills, skillIds, slug, "skill", (id) => ({ skillId: id, skillVersionId: null })),
      mcps: resolveDeps(v.mcps, mcpIds, slug, "mcp", (id) => ({ mcpId: id })),
      releaseNotes: v.releaseNotes ?? undefined,
    })

    const { data: existing } = await client.agent.getBySlug({ path: { slug } })

    let id: string
    if (!existing) {
      const { data: created, error } = await client.agent.create({
        body: { name, icon: icon ?? null, tags, ...versionBody(versions[0]!) },
      })
      if (!created) {
        log.warn(`agent ${slug}: create failed — ${JSON.stringify(error)}`)
        continue
      }
      await client.agent.publish({ path: { id: created.id } })
      id = created.id
      log.ok(`agent: created + published ${slug} v${versions[0]!.version}`)
    } else {
      id = existing.id
      await client.agent.update({ path: { id }, body: { name, icon: icon ?? null, tags } })
      log.step(`agent: updated ${slug}`)
    }

    const { data: present } = await client.agent.version.list({ path: { id } })
    const onServer = new Set((present ?? []).map((v) => v.version))
    const backfill = existing ? versions : versions.slice(1)
    for (const v of backfill) {
      if (onServer.has(v.version)) continue
      const { error } = await client.agent.version.create({ path: { id }, body: versionBody(v) })
      if (error) log.warn(`agent ${slug} v${v.version}: version create failed — ${JSON.stringify(error)}`)
      else log.ok(`agent: added version ${slug} v${v.version}`)
    }
  }
}
