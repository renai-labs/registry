import { describe, expect, test } from "bun:test"
import {
  AgentEntry,
  Bump,
  ClaudePluginManifest,
  GitRef,
  McpEntry,
  Semver,
  SkillEntry,
  SkillFrontmatter,
  SkillVersionEntry,
  Slug,
  SkillsShManifest,
  TagEntry,
} from "../src/index"

describe("Slug", () => {
  test.each([
    "pod-dev",
    "a",
    "x9",
    "skill-with-many-dashes",
    "0number-leading",
  ])("accepts %p", (s) => {
    expect(Slug.safeParse(s).success).toBe(true)
  })

  test.each([
    ["", "empty"],
    ["UPPERCASE", "uppercase letters"],
    ["with_underscore", "underscores"],
    ["-leading-dash", "leading dash"],
    ["trailing-dash-", "trailing dash"],
    ["has spaces", "spaces"],
    ["with.dot", "dot"],
  ])("rejects %p (%s)", (s) => {
    expect(Slug.safeParse(s).success).toBe(false)
  })
})

describe("Semver", () => {
  test.each(["0.0.0", "0.0.1", "1.2.3", "10.20.30"])("accepts %p", (s) => {
    expect(Semver.safeParse(s).success).toBe(true)
  })

  test.each([
    ["1.0", "missing patch"],
    ["1", "missing minor + patch"],
    ["1.0.0-beta", "prerelease tag (not supported)"],
    ["1.0.0+meta", "build metadata"],
    ["v1.0.0", "v prefix"],
    ["1.0.0.0", "too many segments"],
  ])("rejects %p (%s)", (s) => {
    expect(Semver.safeParse(s).success).toBe(false)
  })
})

describe("GitRef", () => {
  test("accepts a 40-char hex SHA", () => {
    expect(GitRef.safeParse("a".repeat(40)).success).toBe(true)
    expect(GitRef.safeParse("0123456789abcdef0123456789abcdef01234567").success).toBe(true)
  })

  test.each([
    ["short", "too short"],
    ["A".repeat(40), "uppercase hex"],
    ["g".repeat(40), "non-hex chars"],
    ["a".repeat(41), "too long"],
  ])("rejects %p (%s)", (s) => {
    expect(GitRef.safeParse(s).success).toBe(false)
  })
})

describe("Bump", () => {
  test("accepts only patch/minor/major", () => {
    expect(Bump.safeParse("patch").success).toBe(true)
    expect(Bump.safeParse("minor").success).toBe(true)
    expect(Bump.safeParse("major").success).toBe(true)
    expect(Bump.safeParse("prerelease").success).toBe(false)
    expect(Bump.safeParse("").success).toBe(false)
  })
})

describe("SkillFrontmatter", () => {
  test("accepts minimal frontmatter", () => {
    const result = SkillFrontmatter.safeParse({ name: "pod-dev", description: "Pod work" })
    expect(result.success).toBe(true)
  })

  test("accepts optional metadata fields", () => {
    const result = SkillFrontmatter.safeParse({
      name: "typefully",
      description: "Social posts",
      license: "MIT",
      author: "Ren Labs",
      source: "https://typefully.com/docs/api",
      homepage: "https://typefully.com",
    })
    expect(result.success).toBe(true)
  })

  test("rejects version field — the canonical drift bug we want stopped at the source", () => {
    const result = SkillFrontmatter.safeParse({
      name: "typefully",
      description: "...",
      version: "0.0.1",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const keys = result.error.issues.flatMap((i) => (i as { keys?: string[] }).keys ?? [])
      expect(keys).toContain("version")
    }
  })

  test("rejects unknown keys (strict mode)", () => {
    const result = SkillFrontmatter.safeParse({
      name: "x",
      description: "...",
      tags: ["foo"],
    })
    expect(result.success).toBe(false)
  })

  test("requires both name and description", () => {
    expect(SkillFrontmatter.safeParse({ name: "x" }).success).toBe(false)
    expect(SkillFrontmatter.safeParse({ description: "x" }).success).toBe(false)
  })

  test("rejects malformed slug in name", () => {
    expect(SkillFrontmatter.safeParse({ name: "BadName", description: "..." }).success).toBe(false)
  })
})

describe("SkillVersionEntry", () => {
  test("accepts a fully populated entry", () => {
    const result = SkillVersionEntry.safeParse({
      version: "0.0.1",
      gitRef: "a".repeat(40),
      publishedAt: "2026-05-29T12:00:00.000Z",
      contentHash: "0123abcd",
    })
    expect(result.success).toBe(true)
  })

  test("accepts a pending entry (null gitRef + publishedAt)", () => {
    const result = SkillVersionEntry.safeParse({
      version: "0.0.1",
      gitRef: null,
      publishedAt: null,
      contentHash: "h",
    })
    expect(result.success).toBe(true)
  })

  test("rejects invalid datetime", () => {
    const result = SkillVersionEntry.safeParse({
      version: "0.0.1",
      gitRef: null,
      publishedAt: "yesterday",
      contentHash: "h",
    })
    expect(result.success).toBe(false)
  })

  test("accepts requiredCredentials", () => {
    const result = SkillVersionEntry.safeParse({
      version: "0.0.1",
      gitRef: null,
      publishedAt: null,
      contentHash: "h",
      requiredCredentials: [{ name: "API_KEY", description: "key" }, { name: "TOKEN" }],
    })
    expect(result.success).toBe(true)
  })

  test("rejects requiredCredentials entries without a name", () => {
    const result = SkillVersionEntry.safeParse({
      version: "0.0.1",
      gitRef: null,
      publishedAt: null,
      contentHash: "h",
      requiredCredentials: [{ description: "no name" }],
    })
    expect(result.success).toBe(false)
  })
})

describe("SkillEntry", () => {
  const minimal = {
    slug: "pod-dev",
    name: "pod-dev",
    description: "Pod work",
    currentVersion: "0.0.1",
    contentHash: "h",
    versions: [{ version: "0.0.1", gitRef: null, publishedAt: null, contentHash: "h" }],
  }

  test("accepts a minimal entry", () => {
    expect(SkillEntry.safeParse(minimal).success).toBe(true)
  })

  test("requires at least one entry in versions[]", () => {
    expect(SkillEntry.safeParse({ ...minimal, versions: [] }).success).toBe(false)
  })

  test("accepts nullable optional metadata", () => {
    const result = SkillEntry.safeParse({
      ...minimal,
      license: null,
      author: null,
      source: null,
      homepage: null,
    })
    expect(result.success).toBe(true)
  })

  test("accepts registry display metadata (icon, docUrl, websiteMetadata, tags)", () => {
    const result = SkillEntry.safeParse({
      ...minimal,
      icon: "https://example.com/icon.png",
      docUrl: "https://example.com/docs",
      websiteMetadata: { supportUrl: "https://example.com/support" },
      tags: ["productivity", "web"],
    })
    expect(result.success).toBe(true)
  })

  test("accepts null display metadata", () => {
    const result = SkillEntry.safeParse({
      ...minimal,
      icon: null,
      docUrl: null,
      websiteMetadata: null,
    })
    expect(result.success).toBe(true)
  })

  test("rejects non-kebab tags", () => {
    expect(SkillEntry.safeParse({ ...minimal, tags: ["Not Kebab"] }).success).toBe(false)
  })
})

describe("ClaudePluginManifest", () => {
  test("accepts manifest with optional version", () => {
    const result = ClaudePluginManifest.safeParse({
      name: "ren",
      description: "...",
      version: "0.1.0",
    })
    expect(result.success).toBe(true)
  })

  test("accepts manifest without version", () => {
    const result = ClaudePluginManifest.safeParse({
      name: "ren",
      description: "...",
    })
    expect(result.success).toBe(true)
  })

  test("passthrough preserves unknown fields", () => {
    const result = ClaudePluginManifest.safeParse({
      name: "ren",
      description: "...",
      $schema: "https://json.schemastore.org/claude-code-plugin-manifest.json",
      repository: "https://github.com/x/y",
      mcpServers: { ren: { type: "http", url: "https://api.renai.build/mcp" } },
    })
    expect(result.success).toBe(true)
  })
})

describe("SkillsShManifest", () => {
  test("accepts the canonical shape", () => {
    const result = SkillsShManifest.safeParse({
      groupings: [{ title: "Ren", skills: ["pod-dev", "agent-dev"] }],
    })
    expect(result.success).toBe(true)
  })

  test("rejects malformed slugs inside groupings", () => {
    const result = SkillsShManifest.safeParse({
      groupings: [{ title: "Ren", skills: ["BadName"] }],
    })
    expect(result.success).toBe(false)
  })
})

describe("Other registry shapes", () => {
  test("TagEntry accepts {name} only", () => {
    expect(TagEntry.safeParse({ name: "automation" }).success).toBe(true)
  })

  test("AgentEntry requires a non-empty versions array", () => {
    expect(AgentEntry.safeParse({ agent: { slug: "a", name: "Agent" }, versions: [] }).success).toBe(false)
  })

  test("AgentEntry accepts the ren registry shape (nested agent + _meta tags)", () => {
    const ok = AgentEntry.safeParse({
      agent: { slug: "ren", name: "Ren", icon: null },
      versions: [
        {
          version: "0.0.1",
          description: "Meta-agent",
          model: "claude-haiku-4-5",
          prompt: "You are Ren.",
          permission: {},
          skills: ["agent-dev", "onboarding"],
          mcps: [],
          releaseNotes: null,
        },
      ],
      _meta: { "com.renai/agent-registry": { tags: ["ren"] } },
    })
    expect(ok.success).toBe(true)
  })

  test("McpEntry accepts the ren registry shape (no contentHash; permissions + urlOptions)", () => {
    const ok = McpEntry.safeParse({
      slug: "linear",
      name: "Linear",
      description: "Linear MCP",
      mcpServerUrl: "https://example.com/mcp",
      urlOptions: [{ url: "https://eu.example.com/mcp", label: "EU", description: "EU residency" }],
      docUrl: null,
      icon: null,
      transport: "streamable-http",
      version: null,
      repository: null,
      tools: ["issue_create"],
      prompts: [],
      auth: "oauth",
      authConfig: { type: "oauth" },
      permissions: "read-write",
      author: { name: "Linear", url: null },
      useCases: ["project-mgmt"],
      sortOrder: null,
      popularityScore: 10,
      trendingScore: null,
      rank: null,
      websiteMetadata: null,
    })
    expect(ok.success).toBe(true)
  })
})
