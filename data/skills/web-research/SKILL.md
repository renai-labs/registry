---
name: web-research
description: Run grounded web research — search the live web, open and extract source pages, crawl a site or map its structure, then return findings with inline citations back to the exact URLs. Use whenever a task needs current facts, figures, quotes, prices, news, competitive/market detail, or any claim that must be backed by a real source rather than model memory. Pairs with research-report when the output is a written deliverable.
---

# Web Research

Turn an open question into a set of **verified, cited claims**. The job is not "find a
page" — it is to gather enough independent, current sources that each claim in the answer
can point to a URL the reader can open.

This runs on the agent's **built-in tools** — `websearch` (Exa-backed, enabled in every pod)
and `webfetch` — so it works with **zero setup**: no key, no MCP, no connect flow. For deep
site work (follow links, map a whole site, bulk-extract), the optional `tavily` MCP adds
`tavily_crawl` / `tavily_map` when it is attached to the agent.

## Workflow

1. **Frame.** Restate the question as 2–5 concrete sub-questions. Note what "good enough"
   evidence looks like (a primary source? two independent confirmations? a dated figure?).
2. **Search broad, then narrow.** Run `websearch` once per sub-question using plain-language
   queries. Read titles + snippets, pick the 2–4 most promising results, and discard SEO
   filler. Re-query with sharper terms when the first pass is thin — do not stop at the first
   hit.
3. **Open the source.** Never cite from a snippet. `webfetch` the chosen URLs to read the
   actual page. Pull the specific sentence, number, or quote you will cite, plus its date.
4. **Go deep when needed.** For multi-step questions where one answer feeds the next query,
   iterate search → fetch → search. To walk a whole site or bulk-extract, use the `tavily`
   MCP's `tavily_crawl` / `tavily_map` if it's attached.
5. **Corroborate.** For any load-bearing or surprising claim, find a second independent
   source. Flag claims you could only confirm once.
6. **Record as you go.** Keep a running log of `{claim, url, exact quote, date accessed}`.
   If a memory store is attached to the agent, persist this log there so a later session can
   extend the research without re-fetching.

## Output contract

Return findings as claims, each with an inline citation, never a bare wall of links:

> Revenue grew 38% YoY in FY2024 [1].

…followed by a numbered source list: `[1] <title> — <url> (accessed YYYY-MM-DD)`.

When the deliverable is a document (brief, memo, report), hand the cited findings to
[[research-report]] rather than formatting prose here.

## Source quality

- Prefer **primary** sources (filings, official docs, the company/author themselves, dated
  press releases) over aggregators and listicles.
- Always capture the **publication date**; mark a figure "as of <date>". Stale data is a
  common, silent error.
- State uncertainty plainly. "Could not verify" and "single source only" are valid, useful
  results — do not paper over a gap with a confident guess.

See `references/query-craft.md` for query patterns and `references/source-triage.md` for
deciding what to trust and what to drop.

## Gotchas

- Snippets lie or go stale — `webfetch` the page before quoting it.
- A site's own search box is often weaker than a `websearch` for `site:example.com <terms>`.
- Paywalled/JS-heavy pages may fetch empty; note it and find an alternate source rather than
  fabricating the content.
- `websearch`/`webfetch` are read-only — they retrieve, they never submit forms, log in, or
  post.
