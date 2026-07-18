---
name: research-report
description: Turn gathered, cited research findings into a finished deliverable — a briefing memo, market/competitive report, literature summary, or decision doc — with a clear thesis, evidence-backed sections, and a traceable bibliography. Use after web-research (or when source material is supplied) and the ask is a written document rather than a chat answer. Outputs via docx / pdf for prose, xlsx for tabular evidence.
---

# Research Report

Assemble verified findings into a document a busy reader can act on: thesis first, evidence
underneath, every non-obvious claim traceable to a source.

This skill **composes**, it does not gather. Get cited findings from [[web-research]] first
(or from supplied material). Render the final file with the reuse skills: prose →
[[docx]] / [[pdf]], tabular evidence or models → [[xlsx]].

## Inputs

- **Findings**: claims with citations `{claim, url, quote, date}` from web-research.
- **Supplied source documents** (optional): PDFs, decks, prior reports the user provides.
  If a file store is attached to the project, read them from it in place (it is mounted
  read-only).
- **Running bibliography** (optional): if a memory store is attached, persist the source
  list there so follow-up reports reuse and extend it across runs.

## Workflow

1. **Find the thesis.** Read all findings and state the single answer / recommendation in
   one sentence. The report exists to support that sentence. If the evidence won't support
   one, say so — that is itself the finding.
2. **Outline by argument, not by source.** Group findings into 3–6 sections that each make
   one point. Order them so the reader could stop after any section and still have the gist
   (most-important first).
3. **Draft top-down.** Lead with a 3–5 bullet executive summary (the thesis + the few
   numbers that matter). Then each section: claim → evidence → implication. Keep every
   load-bearing sentence tied to a citation marker.
4. **Keep citations intact.** Carry the `[n]` markers through to the final doc and end with
   a numbered bibliography (`[n] title — url (accessed date)`). Never strip a citation to
   make prose flow.
5. **Separate fact from inference.** Mark your own analysis ("This suggests…") distinctly
   from sourced fact. Note where evidence was single-source or unverified.
6. **Render.** Choose the format from the deliverable: memo/brief/report → `docx` or `pdf`;
   data tables / comparison matrices / simple models → `xlsx`; if a deck is asked for,
   hand the outline to `pptx`. Apply the chosen skill's formatting conventions.

## Document shapes

- **Briefing memo** — 1 page: summary, 3 sections, recommendation. Default for "brief me on X".
- **Market / competitive report** — summary, landscape, per-player or per-theme sections, a
  comparison table (xlsx or inline), outlook.
- **Literature / source summary** — summary, themes across sources, points of agreement vs.
  disagreement, gaps.
- **Decision doc** — recommendation up front, options compared, risks, what we'd need to be
  true.

See `references/report-structures.md` for fuller skeletons.

## Gotchas

- Don't bury the answer. Executive summary first, every time.
- A report is not a link dump or a quote pile — synthesize across sources into claims; the
  citations support the claim, they aren't the content.
- Match length to the decision. A one-line ask gets a one-page memo, not 12 pages.
- If findings contradict each other, surface the conflict and say which source you trust and
  why — don't silently pick one.
