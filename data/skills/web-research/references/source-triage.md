# Source triage

Deciding what to trust, what to corroborate, and what to drop.

## Tiering

1. **Primary** — the entity itself or an authoritative record: regulatory filings, official
   docs/specs, the company's own site, dated press releases, government/standards bodies,
   peer-reviewed papers. Cite these first.
2. **Reputable secondary** — established outlets and analysts that name their sources and
   date their reporting. Good for context and corroboration.
3. **Aggregators / SEO content / undated listicles** — use only as a pointer to a primary
   source; never cite as the source itself.
4. **Forums / social** — useful as signal ("is anyone hitting this bug?") but treat as
   anecdote, not fact, unless from the verified party.

## Corroboration rule

- A surprising, contested, or load-bearing claim needs **two independent** sources (not two
  outlets re-printing the same wire story — trace to the origin).
- Routine, uncontested facts (a public address, a launch date on the official site) need one
  good source.

## Red flags — downgrade or drop

- No date anywhere on the page.
- The page restates a number with no attribution.
- The "study" links to a vendor selling the solution.
- Circular sourcing: every result traces back to one original claim.
- The extracted content is empty/garbled (paywall or JS render failure) — do not guess what
  it "probably" said.

## Recording

For every cited fact, log: the exact quote/number, the canonical URL (not a tracker/redirect
link), the publication date, and the access date. This is what research-report turns into a
bibliography.
