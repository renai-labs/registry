# Design

Artifacts are documents people re-open and share with colleagues. They should look like a considered
internal tool, not a landing page and not a slide.

## Tokens

Everything visual comes from `src/theme.css`, which the scaffold ships with a light and a dark set of
variables for background, surface, border, text, muted text, accent, radius, and the font stacks. Read
that file before styling anything — it is the current palette, and this document is not a copy of it.

Components read the variables and never hardcode a color. Restyling an artifact is editing that one
file.

Keep both themes defined. The toggle sets `data-theme` on the root and follows the system setting by
default, so a page that only defines light colors looks broken on a dark-mode laptop.

## Type

The system stack is the default and needs no setup. A real typeface is fine when it earns its place —
download the woff2 into `src/`, `@font-face` it, and the bundler inlines it. What never works is
linking to a font host: that request is blocked when the page renders, and it drops to Times with no
error.

- One family. Weight and size carry the hierarchy.
- Page title 24px semibold, section headings 16px semibold, body 14px, labels 12px.
- **All figures get `font-variant-numeric: tabular-nums`.** Without it, columns shift between refreshes
  as digit widths change. This is the most visible detail in a recurring report.
- Right-align numbers in tables, left-align text.

## Layout

- Cap content at ~1200px and center the container, not the text inside it.
- Space on an 8px scale. 24px between sections, 16px inside a card, 8px between a label and its value.
- Lead with the summary. Key numbers at the top, then charts, then detail tables. A reader who stops
  after five seconds should still have the answer.
- Group related things in a card with a border. Skip the shadow — borders are quieter and read better
  in both themes.
- One column on narrow screens. These get opened on phones.

## Charts

Colors come from the ordered `--chart-*` variables in `theme.css`. Use them in order and don't skip, so
the first series of every artifact is the same color.

Override the order when the data has direction: growth is green, loss is red, regardless of position.
Never use red and green as arbitrary category colors — readers assign meaning to them anyway.

- One series: use `--accent`, not a rainbow.
- Label axes with units. `Revenue ($)` beats `Revenue`.
- Start bar charts at zero. Line charts may crop, but say so.
- No pie chart past five slices. Use a bar chart.
- No dual axes, no 3D, no gradients under lines.
- Put the number in the chart when there are few enough bars to read them.

## Anti-patterns

These are the defaults a model reaches for. They make every artifact look like the same template.

- A centered card floating on a gradient background.
- Purple-to-blue gradient headers.
- The same border radius on every element regardless of size.
- Emoji as section icons.
- Animated counters and entrance transitions on a report.
- Six stat tiles where two matter.
- Decorative illustration that carries no information.

## Density

Reports are read, not scrolled past. Prefer a table showing thirty rows over a chart showing five. When
both work, show the chart first and the table under it — one for the shape, one for the values.
