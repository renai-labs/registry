# Query craft

Patterns for turning a question into effective web-research queries.

## Build queries from the sub-question, not the topic

- Bad: `Acme Corp` — too broad, returns the homepage and PR.
- Good: `Acme Corp FY2024 annual revenue` — names the fact you need.
- Good: `Acme Corp pricing enterprise tier 2025` — scopes by recency + facet.

## Operators that work across the research MCPs

- `site:domain.com <terms>` — restrict to one source (filings on `sec.gov`, docs on a
  vendor's domain).
- Quoted `"exact phrase"` — pin a product name, a statute, a precise term of art.
- `<terms> after:2024` or include the year — force recent results when a topic has years of
  stale coverage.
- `<terms> filetype:pdf` — go straight to reports, whitepapers, decks.

## Iterate, don't one-shot

1. First query: plain language, broad.
2. Read what comes back; harvest the *vocabulary the sources actually use* (industry terms,
   official product names, metric names).
3. Re-query with that vocabulary. Domain terms beat paraphrase.

## Multi-hop research

When answer A is the input to query B (e.g. "find the CEO" → "find that person's prior
company"), do it as explicit steps: extract A, confirm it, then construct B from the
confirmed value. Don't try to express the whole chain in one query.

## When results are thin

- Drop the rarest word and re-run.
- Try a synonym set (e.g. "layoffs" / "workforce reduction" / "RIF").
- Switch the source type: news vs. official filing vs. community forum each surface
  different facts.
