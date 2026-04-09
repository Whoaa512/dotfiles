---
name: visual-explainer
description: Create beautiful visual explainers: self-contained HTML/CSS/JS diagrams, charts, scrollytelling pages, concept maps, or data narratives. Use when asked to visualize, explain visually, make a beautiful explainer, create a diagram/report/dashboard, plot data, graph this, or turn a concept/process/system into a visual artifact.
---

# Visual Explainer

Create polished static visual explanations. Default output: a single self-contained HTML file the user can open locally, unless they ask for markdown, SVG, Mermaid, image prompts, or publishing.

## Operating Contract

- Clarify only when missing info blocks progress. Otherwise make smart defaults.
- Never invent data and present it as real. If data is absent, label examples as illustrative.
- Favor one strong visual story over many weak charts.
- Build for comprehension first, aesthetics second.
- Keep files portable: embed data inline; avoid external data files.
- Do not include generator/AI branding in the artifact.

## Step 0: Understand the Job

Identify:

- **Audience** — execs, engineers, customers, learners, etc.
- **Purpose** — explain, compare, diagnose, persuade, teach, monitor.
- **Input type** — concept, process, architecture, timeline, metrics, table, logs, notes.
- **Output shape** — HTML page, chart, diagram, dashboard, slide-like narrative, SVG, Mermaid.
- **Destination** — local file, repo doc, copied snippet, published page.

Ask one focused question if the audience/purpose or data source is unclear and materially affects the design.

## Step 1: Pick the Right Visual Form

| Input / goal | Best form |
|---|---|
| Process, workflow, lifecycle | Stepper, swimlane, Sankey-ish flow, timeline |
| System architecture | Layered boxes, network map, request path, dependency graph |
| Concept explanation | Annotated diagram, comparison cards, mental model map |
| Tradeoffs / options | Matrix, scorecard, quadrant, decision tree |
| Time series | Line / area chart with callouts |
| Category comparison | Bar chart, lollipop chart, ranked cards |
| Composition | Stacked bar, treemap, donut only if very simple |
| Distribution | Histogram, box/violin plot, beeswarm |
| Geography | Map only when geography is the point |
| Dense table | Styled table with sorting/filtering/search |
| Narrative from mixed inputs | Scrollytelling sections with progressive disclosure |

Avoid pie/donut charts unless ≤5 categories and exact comparison is not important.

## Step 2: Visual Story Structure

Use this page structure by default:

1. **Hero** — title, one-sentence takeaway, timestamp/source note if relevant.
2. **Key insight cards** — 3–5 numbers or claims that orient the reader.
3. **Primary visual** — the main chart/diagram with clear annotations.
4. **Explanation** — short sections answering “what am I seeing?” and “why it matters?”
5. **Details** — expandable methodology, raw data, caveats, or alternate views.

For complex explainers, use tabs or sections:

- Overview
- How it works
- Key tradeoffs
- Evidence/data
- Implications / next steps

## Step 3: HTML Baseline

Prefer a single HTML file with:

```html
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: { sans: ['Inter', 'sans-serif'] },
        boxShadow: { soft: '0 20px 70px rgba(15, 23, 42, 0.10)' }
      }
    }
  }
</script>
```

Use one visualization library only when helpful:

| Need | Library |
|---|---|
| Common charts | Chart.js: `https://cdn.jsdelivr.net/npm/chart.js` |
| Custom diagrams / force / hierarchy | D3: `https://d3js.org/d3.v7.min.js` |
| Scientific/statistical interactive plots | Plotly: `https://cdn.plot.ly/plotly-latest.min.js` |
| Diagrams from text | Mermaid: `https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js` |
| Tables only | No library; Tailwind table styles |

If offline/portable is required, skip CDN libraries and use inline SVG/CSS.

## Step 4: Design System Defaults

Use a refined, calm style:

- Page: `min-h-screen bg-slate-50 text-slate-900 font-sans`
- Shell: `max-w-6xl mx-auto px-6 py-10 lg:py-14`
- Cards: `rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70`
- Muted text: `text-slate-500`
- Accent palette: blue/indigo/cyan for neutral technical work; emerald for positive, amber for caution, rose for risk.
- Typography: big crisp headline, short subtitles, no walls of text.
- Spacing: generous whitespace, consistent `gap-4/6/8`.
- Responsiveness: single column on mobile, grids from `md:` upward.

## Step 5: Make It Beautiful and Useful

Checklist before writing final artifact:

- [ ] Clear title states the subject, not “Visualization”.
- [ ] Subtitle gives the main takeaway.
- [ ] Every chart has labeled axes/units and direct annotations where useful.
- [ ] Colors encode meaning consistently and accessibly.
- [ ] Legends are close to the data or replaced with direct labels.
- [ ] Important outliers/turning points are called out.
- [ ] The reader knows source, freshness, and caveats.
- [ ] Mobile layout is usable.
- [ ] Empty/error states exist if user will swap in data later.

## Step 6: Interaction Guidelines

Use interaction sparingly:

- Tabs for alternate views.
- Toggles for assumptions/scenarios.
- Hover tooltips for details, not core meaning.
- Expanders for methodology/raw data.
- Filters only when the dataset is large enough to need them.

Prefer Alpine.js for simple UI state (`x-data`, `x-show`, `@click`). Avoid complex imperative JS unless the visualization requires it.

## Step 7: Data Handling

- Parse provided files/data directly when possible.
- Normalize units and dates; mention assumptions.
- Embed the cleaned data as a JS constant in the HTML.
- If transforming data, keep a small “Method” section or code comment only if useful.
- If data is sensitive, avoid publishing; write local-only output unless user explicitly asks.

## Step 8: Delivery

When creating files:

- Put artifacts in the location requested by user; otherwise use a descriptive local path like `visual-explainers/<slug>.html`.
- Use filenames like `<topic>-visual-explainer.html` or `<topic>-<YYYYMMDD>.html`.
- If modifying a repo, run appropriate formatting/checks and commit as requested by repo/session rules.

Report back with:

- File path(s)
- How to open/view
- Data/source assumptions
- Any caveats or next improvements

## Small HTML Skeleton

Use this as a starting point, not a rigid template:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Explainer Title</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <script>
    tailwind.config = { theme: { extend: { fontFamily: { sans: ['Inter', 'sans-serif'] } } } }
  </script>
</head>
<body class="min-h-screen bg-slate-50 text-slate-900 font-sans">
  <main class="mx-auto max-w-6xl px-6 py-10 lg:py-14">
    <section class="mb-8">
      <p class="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-600">Visual explainer</p>
      <h1 class="text-4xl font-extrabold tracking-tight md:text-6xl">Explainer Title</h1>
      <p class="mt-4 max-w-3xl text-lg text-slate-600">One sentence takeaway.</p>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <article class="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200/70">
        <p class="text-sm text-slate-500">Signal</p>
        <p class="mt-2 text-3xl font-bold">Value</p>
        <p class="mt-2 text-sm text-slate-500">Why it matters.</p>
      </article>
    </section>

    <section class="mt-6 rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
      <div class="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 class="text-2xl font-bold">Main visual</h2>
          <p class="text-slate-500">Short explanation of how to read it.</p>
        </div>
      </div>
      <div class="min-h-80 rounded-2xl bg-slate-100 p-6">
        <!-- chart, SVG, or diagram goes here -->
      </div>
    </section>
  </main>
</body>
</html>
```
