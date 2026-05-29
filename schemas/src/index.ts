import { z } from "zod"
import {
  zMcp,
  zMcpAuthConfig,
  zPermissionConfig,
  zRepository,
  zWebsiteMetadata,
} from "@renai-labs/sdk/zod"

export const Repository = zRepository
export type Repository = z.infer<typeof Repository>

export const WebsiteMetadata = zWebsiteMetadata
export type WebsiteMetadata = z.infer<typeof WebsiteMetadata>

export const McpAuthConfig = zMcpAuthConfig
export type McpAuthConfig = z.infer<typeof McpAuthConfig>

export const McpAuth = zMcp.shape.auth
export type McpAuth = z.infer<typeof McpAuth>

export const McpTransport = zMcp.shape.transport
export type McpTransport = z.infer<typeof McpTransport>

export const PermissionConfig = zPermissionConfig
export type PermissionConfig = z.infer<typeof PermissionConfig>

export const Slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case lowercase, no leading/trailing/double dashes")

export const Semver = z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver x.y.z")

export const GitRef = z.string().regex(/^[0-9a-f]{40}$/, "gitRef must be a 40-char commit SHA")

export const Bump = z.enum(["patch", "minor", "major"])
export type Bump = z.infer<typeof Bump>

// version is owned by data/skills.json, not SKILL.md; .strict() rejects unknown keys (e.g. a pasted `version:`)

export const SkillFrontmatter = z
  .object({
    name: Slug,
    description: z.string().min(1).max(1024),
    license: z.string().optional(),
    author: z.string().optional(),
    source: z.string().optional(),
    homepage: z.url().optional(),
  })
  .strict()
export type SkillFrontmatter = z.infer<typeof SkillFrontmatter>

// CLI is the only writer; hand-edits are rejected by `ren-registry check` (re-derives every contentHash from disk).
// `gitRef` is null between `release` and `publish`: release records the entry without the SHA; publish backfills it.

export const SkillVersionEntry = z.object({
  version: Semver,
  gitRef: GitRef.nullable(),
  publishedAt: z.iso.datetime().nullable(),
  contentHash: z.string().min(1),
  releaseNotes: z.string().nullable().optional(),
  requiredCredentials: z
    .array(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .optional(),
})
export type SkillVersionEntry = z.infer<typeof SkillVersionEntry>

export const SkillEntry = z.object({
  slug: Slug,
  name: z.string().min(1),
  description: z.string().min(1),
  license: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  homepage: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  docUrl: z.string().nullable().optional(),
  websiteMetadata: WebsiteMetadata.nullable().optional(),
  tags: z.array(Slug).optional(),
  currentVersion: Semver,
  contentHash: z.string().min(1),
  versions: z.array(SkillVersionEntry).min(1),
})
export type SkillEntry = z.infer<typeof SkillEntry>

export const SkillsRegistry = z.array(SkillEntry)
export type SkillsRegistry = z.infer<typeof SkillsRegistry>

// DepRef is a string (track latest) or {slug, version} (pinned)

export const DepRef = z.union([Slug, z.object({ slug: Slug, version: Semver.optional() })])
export type DepRef = z.infer<typeof DepRef>

export const AgentVersionEntry = z.object({
  version: Semver,
  description: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  prompt: z.string().optional(),
  permission: PermissionConfig.optional(),
  skills: z.array(DepRef).optional(),
  mcps: z.array(DepRef).optional(),
  releaseNotes: z.string().nullable().optional(),
})
export type AgentVersionEntry = z.infer<typeof AgentVersionEntry>

export const AgentEntry = z.object({
  agent: z.object({
    slug: Slug,
    name: z.string().min(1),
    icon: z.string().nullable().optional(),
  }),
  versions: z.array(AgentVersionEntry).min(1),
  _meta: z
    .object({
      "com.renai/agent-registry": z.object({ tags: z.array(Slug).optional() }).optional(),
    })
    .optional(),
})
export type AgentEntry = z.infer<typeof AgentEntry>

export const AgentsRegistry = z.array(AgentEntry)
export type AgentsRegistry = z.infer<typeof AgentsRegistry>

export const McpUrlOption = z.object({
  url: z.string(),
  label: z.string(),
  description: z.string().optional(),
})
export type McpUrlOption = z.infer<typeof McpUrlOption>

export const McpEntry = z.object({
  slug: Slug,
  name: z.string().min(1),
  description: z.string().min(1),
  mcpServerUrl: z.string().nullable(),
  urlOptions: z.array(McpUrlOption).nullable().optional(),
  docUrl: z.string().nullable(),
  icon: z.string().nullable(),
  transport: McpTransport,
  version: z.string().nullable(),
  repository: Repository.nullable(),
  tools: z.array(z.string()),
  prompts: z.array(z.string()),
  auth: McpAuth,
  authConfig: McpAuthConfig.nullable().optional(),
  permissions: z.string().nullable().optional(),
  author: z.object({ name: z.string(), url: z.string().nullable() }).nullable(),
  useCases: z.array(Slug),
  sortOrder: z.number().nullable().optional(),
  popularityScore: z.number().nullable().optional(),
  trendingScore: z.number().nullable().optional(),
  rank: z.number().nullable().optional(),
  websiteMetadata: WebsiteMetadata.nullable(),
})
export type McpEntry = z.infer<typeof McpEntry>

export const McpsRegistry = z.array(McpEntry)
export type McpsRegistry = z.infer<typeof McpsRegistry>

export const TagEntry = z.object({
  name: Slug,
  description: z.string().nullable().optional(),
})
export type TagEntry = z.infer<typeof TagEntry>

export const TagsRegistry = z.array(TagEntry)
export type TagsRegistry = z.infer<typeof TagsRegistry>

export const PluginMcpServer = z
  .object({
    type: z.enum(["http", "sse", "stdio"]).optional(),
    url: z.url().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
  })
  .passthrough()

export const ClaudePluginManifest = z
  .object({
    $schema: z.string().optional(),
    name: Slug,
    displayName: z.string().optional(),
    description: z.string(),
    version: Semver.optional(),
    repository: z.string().optional(),
    mcpServers: z.record(z.string(), PluginMcpServer).optional(),
  })
  .passthrough()
export type ClaudePluginManifest = z.infer<typeof ClaudePluginManifest>

export const CodexPluginManifest = z
  .object({
    name: Slug,
    version: Semver,
    description: z.string(),
    skills: z.string(),
    mcpServers: z.record(z.string(), PluginMcpServer).optional(),
    interface: z
      .object({
        displayName: z.string(),
        shortDescription: z.string(),
        longDescription: z.string(),
      })
      .partial()
      .optional(),
  })
  .passthrough()
export type CodexPluginManifest = z.infer<typeof CodexPluginManifest>

export const MarketplaceManifest = z
  .object({
    $schema: z.string().optional(),
    name: Slug,
    owner: z.object({ name: z.string(), url: z.url().optional() }),
    metadata: z.object({ pluginRoot: z.string().optional() }).optional(),
    plugins: z.array(
      z.object({
        name: Slug,
        source: z.string(),
        description: z.string(),
      }),
    ),
  })
  .passthrough()
export type MarketplaceManifest = z.infer<typeof MarketplaceManifest>

export const SkillsShManifest = z.object({
  $schema: z.string().optional(),
  groupings: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      skills: z.array(Slug),
    }),
  ),
})
export type SkillsShManifest = z.infer<typeof SkillsShManifest>
