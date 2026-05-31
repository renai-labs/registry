import { describe, expect, test } from "bun:test"
import type { RenClient } from "@renai-labs/sdk"
import type { AgentEntry, AgentVersionEntry, McpEntry, SkillEntry, SkillVersionEntry } from "@renai-labs/registry-schemas"
import {
  jsonArray,
  publishAgents,
  publishedVersions,
  publishMcps,
  publishSkills,
  resolveDeps,
} from "@/commands/publish"

type RecordedCall = { method: string; arg: unknown }

type Seed = {
  skills?: Record<string, { id: string; versions?: string[] }>
  mcps?: Record<string, { id: string }>
  agents?: Record<string, { id: string; versions?: string[] }>
  failCreate?: Set<string>
}

function makeClient(seed: Seed = {}) {
  const calls: RecordedCall[] = []
  let n = 0
  const rec = <T>(method: string, arg: unknown, ret: T): T => {
    calls.push({ method, arg })
    return ret
  }
  const versionsOf = (table: Record<string, { id: string; versions?: string[] }>, id: string) => {
    const e = Object.values(table).find((x) => x.id === id)
    return (e?.versions ?? []).map((v) => ({ version: v }))
  }

  const skills = seed.skills ?? {}
  const mcps = seed.mcps ?? {}
  const agents = seed.agents ?? {}
  const failCreate = seed.failCreate ?? new Set<string>()

  const created = (slug: string) =>
    failCreate.has(slug) ? { data: undefined, error: { error: "boom" } } : { data: { id: `new_${++n}` }, error: undefined }

  const client = {
    skill: {
      getBySlug: async ({ path }: any) =>
        rec("skill.getBySlug", path, { data: skills[path.slug] ? { id: skills[path.slug]!.id } : undefined }),
      create: async ({ body }: any) => rec("skill.create", body, created(body.name)),
      publish: async ({ path }: any) => rec("skill.publish", path, { data: {} }),
      update: async ({ path, body }: any) => rec("skill.update", { path, body }, { data: {} }),
      version: {
        list: async ({ path }: any) => rec("skill.version.list", path, { data: versionsOf(skills, path.id) }),
        create: async ({ path, body }: any) => rec("skill.version.create", { path, body }, { error: undefined }),
      },
    },
    mcp: {
      getBySlug: async ({ path }: any) =>
        rec("mcp.getBySlug", path, { data: mcps[path.slug] ? { id: mcps[path.slug]!.id } : undefined }),
      create: async ({ body }: any) => rec("mcp.create", body, created(body.name)),
      publish: async ({ path }: any) => rec("mcp.publish", path, { data: {} }),
      update: async ({ path, body }: any) => rec("mcp.update", { path, body }, { data: {} }),
    },
    agent: {
      getBySlug: async ({ path }: any) =>
        rec("agent.getBySlug", path, { data: agents[path.slug] ? { id: agents[path.slug]!.id } : undefined }),
      create: async ({ body }: any) => rec("agent.create", body, created(body.name)),
      publish: async ({ path }: any) => rec("agent.publish", path, { data: {} }),
      update: async ({ path, body }: any) => rec("agent.update", { path, body }, { data: {} }),
      version: {
        list: async ({ path }: any) => rec("agent.version.list", path, { data: versionsOf(agents, path.id) }),
        create: async ({ path, body }: any) => rec("agent.version.create", { path, body }, { error: undefined }),
      },
    },
  }

  return { client: client as unknown as RenClient, calls }
}

const where = (calls: RecordedCall[], method: string) => calls.filter((c) => c.method === method)
const argOf = (calls: RecordedCall[], method: string) => where(calls, method).map((c) => c.arg as any)

const sv = (version: string, gitRef: string | null, extra: Partial<SkillVersionEntry> = {}): SkillVersionEntry => ({
  version,
  gitRef,
  publishedAt: null,
  contentHash: "h",
  ...extra,
})

const skill = (slug: string, versions: SkillVersionEntry[], extra: Partial<SkillEntry> = {}): SkillEntry => ({
  slug,
  name: slug,
  description: "desc",
  currentVersion: versions[versions.length - 1]?.version ?? "0.0.1",
  contentHash: "h",
  versions,
  ...extra,
})

const av = (version: string, extra: Partial<AgentVersionEntry> = {}): AgentVersionEntry => ({
  version,
  ...extra,
})

const agent = (slug: string, versions: AgentVersionEntry[], tags?: string[]): AgentEntry => ({
  agent: { slug, name: slug, icon: null },
  versions,
  ...(tags ? { _meta: { "com.renai/agent-registry": { tags } } } : {}),
})

const mcp = (slug: string, extra: Partial<McpEntry> = {}): McpEntry => ({
  slug,
  name: slug,
  description: "desc",
  mcpServerUrl: "https://example.com/mcp",
  docUrl: null,
  icon: null,
  transport: "streamable-http",
  version: null,
  repository: null,
  tools: [],
  prompts: [],
  auth: "none",
  authConfig: null,
  author: null,
  useCases: [],
  websiteMetadata: null,
  ...extra,
})

describe("jsonArray", () => {
  test("encodes non-empty arrays, undefined otherwise", () => {
    expect(jsonArray(["a", "b"])).toBe('["a","b"]')
    expect(jsonArray([])).toBeUndefined()
    expect(jsonArray(undefined)).toBeUndefined()
  })
})

describe("publishedVersions", () => {
  test("drops unpublished (null gitRef) and sorts ascending", () => {
    const versions = [sv("1.0.0", "r3"), sv("0.0.1", "r1"), sv("0.2.0", null), sv("0.1.0", "r2")]
    expect(publishedVersions(versions).map((v) => v.version)).toEqual(["0.0.1", "0.1.0", "1.0.0"])
  })

  test("returns empty when nothing is published", () => {
    expect(publishedVersions([sv("0.0.1", null)])).toEqual([])
  })
})

describe("resolveDeps", () => {
  const ids = new Map([["known", "id-1"]])

  test("resolves string and object refs, drops unknown", () => {
    const out = resolveDeps(["known", { slug: "missing" }, { slug: "known" }], ids, "agent-x", "skill", (id) => ({ id }))
    expect(out).toEqual([{ id: "id-1" }, { id: "id-1" }])
  })

  test("empty/undefined refs yield empty", () => {
    expect(resolveDeps(undefined, ids, "a", "skill", (id) => id)).toEqual([])
    expect(resolveDeps([], ids, "a", "skill", (id) => id)).toEqual([])
  })
})

describe("publishSkills", () => {
  test("new skill: create + publish, then backfill higher versions only", async () => {
    const { client, calls } = makeClient()
    const ids = await publishSkills(client, [skill("my-skill", [sv("0.1.0", "rB"), sv("0.0.1", "rA")])])

    expect(where(calls, "skill.create")).toHaveLength(1)
    expect(where(calls, "skill.publish")).toHaveLength(1)

    const body = argOf(calls, "skill.create")[0]
    expect(body.source).toContain("rA")
    expect(body.source).toContain("data/skills/my-skill")
    expect(body.files).toEqual([])

    const vCreates = argOf(calls, "skill.version.create")
    expect(vCreates.map((a) => a.body.version)).toEqual(["0.1.0"])
    expect(ids.get("my-skill")).toBe("new_1")
  })

  test("existing skill: update + only missing versions, no create/publish", async () => {
    const { client, calls } = makeClient({ skills: { "my-skill": { id: "sid", versions: ["0.0.1"] } } })
    const ids = await publishSkills(client, [skill("my-skill", [sv("0.0.1", "rA"), sv("0.1.0", "rB")])])

    expect(where(calls, "skill.create")).toHaveLength(0)
    expect(where(calls, "skill.publish")).toHaveLength(0)
    expect(where(calls, "skill.update")).toHaveLength(1)

    const vCreates = argOf(calls, "skill.version.create")
    expect(vCreates.map((a) => a.body.version)).toEqual(["0.1.0"])
    expect(ids.get("my-skill")).toBe("sid")
  })

  test("forwards tags and requiredCredentials from metadata as JSON", async () => {
    const { client, calls } = makeClient()
    await publishSkills(client, [
      skill("s", [sv("0.0.1", "rA")], { metadata: { tags: ["a", "b"], requiredCredentials: [{ name: "API_KEY" }] } }),
    ])
    const body = argOf(calls, "skill.create")[0]
    expect(body.tags).toBe('["a","b"]')
    expect(body.requiredCredentials).toBe('[{"name":"API_KEY"}]')
  })

  test("skips entries with no published versions", async () => {
    const { client, calls } = makeClient()
    const ids = await publishSkills(client, [skill("draft", [sv("0.0.1", null)])])
    expect(calls).toHaveLength(0)
    expect(ids.size).toBe(0)
  })

  test("create failure: warns, skips backfill, omits from id map", async () => {
    const { client, calls } = makeClient({ failCreate: new Set(["my-skill"]) })
    const ids = await publishSkills(client, [skill("my-skill", [sv("0.0.1", "rA"), sv("0.1.0", "rB")])])
    expect(where(calls, "skill.publish")).toHaveLength(0)
    expect(where(calls, "skill.version.create")).toHaveLength(0)
    expect(ids.has("my-skill")).toBe(false)
  })

  test("existing skill: update re-sends tags", async () => {
    const { client, calls } = makeClient({ skills: { s: { id: "sid", versions: ["0.0.1"] } } })
    await publishSkills(client, [skill("s", [sv("0.0.1", "rA")], { metadata: { tags: ["alpha", "beta"] } })])
    const { body } = argOf(calls, "skill.update")[0]
    expect(body.tags).toEqual(["alpha", "beta"])
  })

  test("update sends websiteMetadata when curated, omits it otherwise", async () => {
    const { client, calls } = makeClient({ skills: { s: { id: "sid", versions: ["0.0.1"] } } })
    await publishSkills(client, [skill("s", [sv("0.0.1", "rA")], { websiteMetadata: { supportUrl: "https://x.com/help" } })])
    expect(argOf(calls, "skill.update")[0].body.websiteMetadata).toEqual({ supportUrl: "https://x.com/help" })

    const { client: c2, calls: calls2 } = makeClient({ skills: { s: { id: "sid", versions: ["0.0.1"] } } })
    await publishSkills(c2, [skill("s", [sv("0.0.1", "rA")])])
    expect("websiteMetadata" in argOf(calls2, "skill.update")[0].body).toBe(false)
  })

  test("existing skill with every version already on server: update only, no version.create", async () => {
    const { client, calls } = makeClient({ skills: { s: { id: "sid", versions: ["0.0.1", "0.1.0"] } } })
    await publishSkills(client, [skill("s", [sv("0.0.1", "rA"), sv("0.1.0", "rB")])])
    expect(where(calls, "skill.update")).toHaveLength(1)
    expect(where(calls, "skill.version.create")).toHaveLength(0)
  })
})

describe("publishMcps", () => {
  test("new mcp: create + publish", async () => {
    const { client, calls } = makeClient()
    const ids = await publishMcps(client, [mcp("server", { useCases: ["search"] })])
    expect(where(calls, "mcp.create")).toHaveLength(1)
    expect(where(calls, "mcp.publish")).toHaveLength(1)
    expect(argOf(calls, "mcp.create")[0].tags).toEqual(["search"])
    expect(ids.get("server")).toBe("new_1")
  })

  test("existing mcp: update only", async () => {
    const { client, calls } = makeClient({ mcps: { server: { id: "mid" } } })
    const ids = await publishMcps(client, [mcp("server")])
    expect(where(calls, "mcp.create")).toHaveLength(0)
    expect(where(calls, "mcp.update")).toHaveLength(1)
    expect(ids.get("server")).toBe("mid")
  })

  test("skips new mcp without a server url", async () => {
    const { client, calls } = makeClient()
    const ids = await publishMcps(client, [mcp("server", { mcpServerUrl: null })])
    expect(where(calls, "mcp.create")).toHaveLength(0)
    expect(ids.size).toBe(0)
  })

  test("forwards explicit authConfig and maps useCases → tags on create", async () => {
    const { client, calls } = makeClient()
    await publishMcps(client, [
      mcp("custom", { auth: "api_key", authConfig: { type: "api_key", headerName: "X-API-Key" }, useCases: ["code"] }),
    ])
    const body = argOf(calls, "mcp.create")[0]
    expect(body.auth).toBe("api_key")
    expect(body.authConfig).toEqual({ type: "api_key", headerName: "X-API-Key" })
    expect(body.tags).toEqual(["code"])
  })

  test("existing mcp: update re-sends auth, authConfig, and useCases as tags", async () => {
    const { client, calls } = makeClient({ mcps: { server: { id: "mid" } } })
    await publishMcps(client, [mcp("server", { auth: "oauth", authConfig: { type: "oauth" }, useCases: ["data"] })])
    const { body } = argOf(calls, "mcp.update")[0]
    expect(body.auth).toBe("oauth")
    expect(body.authConfig).toEqual({ type: "oauth" })
    expect(body.tags).toEqual(["data"])
  })
})

describe("publishAgents", () => {
  const skillIds = new Map([["skill-a", "sid"]])
  const mcpIds = new Map([["mcp-b", "mid"]])

  test("new agent: create + publish, resolving deps and dropping unknown", async () => {
    const { client, calls } = makeClient()
    await publishAgents(
      client,
      [
        agent("bot", [
          av("0.0.1", {
            prompt: "hi",
            skills: ["skill-a", "ghost"],
            mcps: [{ slug: "mcp-b" }],
          }),
        ]),
      ],
      skillIds,
      mcpIds,
    )

    expect(where(calls, "agent.create")).toHaveLength(1)
    expect(where(calls, "agent.publish")).toHaveLength(1)

    const body = argOf(calls, "agent.create")[0]
    expect(body.skills).toEqual([{ skillId: "sid", skillVersionId: null }])
    expect(body.mcps).toEqual([{ mcpId: "mid" }])
    expect(body.version).toBe("0.0.1")
  })

  test("forwards _meta tags on create", async () => {
    const { client, calls } = makeClient()
    await publishAgents(client, [agent("bot", [av("0.0.1", { prompt: "hi" })], ["ren"])], new Map(), new Map())
    expect(argOf(calls, "agent.create")[0].tags).toEqual(["ren"])
  })

  test("new agent with multiple versions: create the lowest, backfill the rest ascending", async () => {
    const { client, calls } = makeClient()
    await publishAgents(
      client,
      [agent("bot", [av("0.1.0", { prompt: "b" }), av("0.0.1", { prompt: "a" })])],
      new Map(),
      new Map(),
    )
    expect(where(calls, "agent.create")).toHaveLength(1)
    expect(argOf(calls, "agent.create")[0].version).toBe("0.0.1")
    expect(argOf(calls, "agent.version.create").map((a) => a.body.version)).toEqual(["0.1.0"])
  })

  test("existing agent: update metadata + backfill missing versions", async () => {
    const { client, calls } = makeClient({ agents: { bot: { id: "aid", versions: ["0.0.1"] } } })
    await publishAgents(
      client,
      [agent("bot", [av("0.0.1", { prompt: "a" }), av("0.1.0", { prompt: "b" })])],
      new Map(),
      new Map(),
    )
    expect(where(calls, "agent.create")).toHaveLength(0)
    expect(where(calls, "agent.update")).toHaveLength(1)
    expect(argOf(calls, "agent.version.create").map((a) => a.body.version)).toEqual(["0.1.0"])
  })
})

// Mirrors seed-registry's orchestration test: skills/mcps publish first, then
// the agent's slug refs resolve against the ids those calls returned.

describe("publish orchestration", () => {
  test("threads skill + mcp ids so agent deps resolve against freshly published entities", async () => {
    const { client, calls } = makeClient()
    const skillIds = await publishSkills(client, [skill("helper", [sv("1.0.0", "rA")])])
    const mcpIds = await publishMcps(client, [mcp("linear")])
    await publishAgents(
      client,
      [agent("ren", [av("1.0.0", { prompt: "hi", skills: ["helper"], mcps: [{ slug: "linear" }] })], ["ren"])],
      skillIds,
      mcpIds,
    )

    const body = argOf(calls, "agent.create")[0]
    expect(body.skills).toEqual([{ skillId: skillIds.get("helper"), skillVersionId: null }])
    expect(body.mcps).toEqual([{ mcpId: mcpIds.get("linear") }])
    expect(body.tags).toEqual(["ren"])
  })

  test("agent refs resolve against pre-existing published skills/mcps (empty maps drop them)", async () => {
    const { client, calls } = makeClient()
    await publishAgents(
      client,
      [agent("ren", [av("1.0.0", { prompt: "hi", skills: ["helper"], mcps: [{ slug: "linear" }] })])],
      new Map(),
      new Map(),
    )
    const body = argOf(calls, "agent.create")[0]
    expect(body.skills).toEqual([])
    expect(body.mcps).toEqual([])
  })
})
