# "Why not just X?"

Pull the row that matches their stack. Give each tool credit for what it does well, then say what
they **can't** get out of it, in their own outcome terms.

| Tool                            | Designed for                                   | Where it breaks down                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| n8n / Zapier                    | Deterministic automation over stable APIs      | Brittle when rules shift or inputs get fuzzy. No way to say "use judgment" and have it work. Edge cases fall back onto humans.                                                    |
| Hosted Claude / ChatGPT Teams   | Chat copilot                                   | Not built for agentic work — no schedules, no webhooks, non-persistent sandboxes. These companies ship separate coding agents because sustained stateful work is a different category. |
| Claude Code / OpenCode / Hermes | Coding agent for one developer in one terminal | One person, one machine, one session. Nothing survives past the terminal.                                                                                                         |
| Claude / Google managed agents  | One agent inside one app, via API              | Locked to one vendor's model and MCPs. No cross-agent memory, no teammates in thread, no per-tool-call cost visibility.                                                           |

What Ren adds, in the same terms: durable pods that keep running after the terminal closes, one
credential set shared across humans and agents, schedules and channel ingress, a replay and cost
trail per run, and a registry of skills and MCPs to reuse instead of rebuild.
