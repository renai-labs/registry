# Ren Data Model

## Primitives

**Skill** — a SKILL.md file (frontmatter + markdown) that teaches an agent how to do a specific thing. Pure knowledge — no state, no identity. Invoked automatically when the agent's task matches the skill's description.

**Agent** — a system prompt + model + dependencies (skills + MCPs). Has an identity, a DM channel, and a version history. The skill layer handles *how*; the agent decides *when* and *what*.

**MCP** — an external integration (GitHub, Slack, Notion, etc.) that gives an agent access to real-world tools. Attached to an agent with optional permission rules.

**Routine** — a cron-scheduled job that sends a prompt to an agent automatically.

---

## When to use a skill vs an agent

Use a **skill** when:
- The capability is reusable across multiple agents
- It's a workflow or process, not an identity ("how to review a PR" not "the PR reviewer")
- No persistent state or dedicated channel is needed

Use an **agent** when:
- The user will DM it directly or assign it as the owner of a domain
- It needs its own set of MCPs and permissions
- It represents a role ("the PR Reviewer", "the Data Analyst")

Rule of thumb: skills are verbs, agents are nouns.

---

## When to use a subagent

Use a **subagent** when a task requires specialised tools or knowledge that the parent agent shouldn't carry in every turn. The parent orchestrates; the subagent executes.

Examples:
- Ren (meta-agent) → delegates skill authoring to skill-manager, agent authoring to agent-manager
- A project manager agent → delegates code review to a code-reviewer agent

Avoid subagents for simple, single-step tasks — the overhead isn't worth it.

---

## How to configure a project

A minimal working project has:
1. One or more **skills** that encode domain workflows
2. One **agent** that owns the domain, with those skills attached
3. The **MCPs** the agent needs to act on the world

Add a **routine** if the agent should run on a schedule rather than on demand.

Build order: skills → agent (agents depend on skills, not the other way around).
