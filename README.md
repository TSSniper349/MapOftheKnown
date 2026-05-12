# Map of the Known

An interactive time-axis network of human knowledge, from the emergence of language (~150,000 years ago) to the research frontiers of 2026. Events are nodes; intellectual influences are edges. The data is curated, not exhaustive; the point is the shape of the graph.

**366 events** &middot; **412 influences** &middot; **11 domain swimlanes** &middot; **5 piecewise-compressed eras**

---

## Run it

```bash
npm install
npm run dev      # local dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # serve the production build
npm run typecheck
```

The site is static and deploys to Vercel, Netlify, GitHub Pages, or any static host.

## What you can do with it

| Interaction | How |
|---|---|
| Pan & zoom | drag, scroll wheel, pinch |
| Read an event | click a node — detail slides in from the right |
| Trace an influence chain | select a node, press **I** (or click *Trace influences*) — ancestors glow blue, descendants amber. Depth slider for 1 / 2 / all hops |
| Compare two events | **shift-click** two nodes — shortest influence path is drawn with a step-by-step narrative |
| Narrow the time window | drag the handles on the bottom scrubber, or click an era button |
| Hide/show domains | click a lane label on the left, or use the **Domains** panel |
| Importance threshold | drag the slider in the **Controls** panel (only events of importance ≥ N) |
| Search | **/** focuses the search box; matches against label, description, and key figures |
| Toggle edges | press **E** or use the **Edges** checkbox |
| Mobile | falls back to an era-grouped list view (the network is too dense to be useful on a small screen) |

## Visual language

- **Background**: parchment, a warm off-white with subtle grain
- **Type**: EB Garamond serif for prose and labels, Inter sans for UI
- **Color**: muted, desaturated jewel tones, one per domain (deep navy, oxblood, forest green, ochre, plum, slate, terracotta, etc.)
- **Node size**: proportional to event importance (1–5)
- **Frontier events**: dashed border with a gentle outward glow
- **Edge styles**: solid + arrow for `enables`; dashed for `influences`; solid + open diamond for `refines`
- **Era boundaries**: vertical dashed rules with small-caps era labels at the top
- **Lane bands**: alternating very-faint tints separating domains on the Y axis

## Time scale

Linear time across 150,000 years is unreadable — over 95% of events fall in the last 500 years. The X axis uses a **piecewise compression** so each era gets roughly comparable screen real estate at default zoom:

| Era | Range | Default screen share |
|---|---|---|
| Prehistory | ~150,000 BCE – 3000 BCE | 13% |
| Antiquity | 3000 BCE – 500 CE | 16% |
| Medieval / Early Modern | 500 – 1700 | 18% |
| Modern | 1700 – 1900 | 18% |
| Contemporary | 1900 – 2026 | 35% |

Inside each era the scale is linear, so relative ordering and spacing are preserved within an era. Zooming via the scrubber or scroll wheel enlarges any sub-range to the full canvas — effectively giving "semantic zoom" into a denser local timeline.

## Domain swimlanes

The Y axis is divided into 11 swimlanes (top to bottom):

1. **Language & Communication** — writing systems, alphabets, linguistic theory, mass-media tech
2. **Mathematics & Logic** — number, geometry, algebra, analysis, formal logic
3. **Philosophy** — metaphysics, epistemology, philosophy of mind, ethics, political theory
4. **Physics & Astronomy** — mechanics, optics, electromagnetism, relativity, quantum, cosmology
5. **Chemistry & Materials** — atoms, bonds, materials, industrial processes
6. **Life Sciences** — natural history, taxonomy, evolution, cell biology, molecular biology, genetics, neuroscience
7. **Medicine & Health** — clinical medicine, public health, surgery, pharmacology, vaccinology
8. **Earth & Environment** — geology, paleontology, climate, ecology
9. **Social Sciences** — economics, sociology, anthropology, psychology, linguistics
10. **Computer & Information** — computability, languages, networks, AI, cryptography
11. **Engineering & Applied Sciences** — metallurgy, civil works, machines, electronics, aerospace

A few events sit awkwardly between lanes (paper, gunpowder, mathematical logic) — they are placed where the *kind* of contribution they made is best categorized, not where their inventor's discipline is conventionally listed.

## Data schema

Events and influences live in [`public/events.json`](public/events.json), loaded at runtime. The shape:

```json
{
  "_meta": { "version": "0.3", ... },
  "nodes": [
    {
      "id": "evt_005_euclid",
      "label": "Euclidean geometry",
      "date": -300,
      "dateUncertainty": 30,
      "domain": "math",
      "subdomain": "geometry",
      "description": "Euclid's Elements systematized…",
      "keyFigures": ["Euclid"],
      "importance": 5,
      "frontier": false,
      "sources": []
    }
  ],
  "edges": [
    {
      "source": "evt_005_euclid",
      "target": "evt_016_principia",
      "type": "enables",
      "description": "Newton presented mechanics in Euclidean geometric form."
    }
  ]
}
```

Required fields:

- **`id`** — globally unique. Convention: `evt_<slug>` or `evt_<n>_<slug>` for the original seed.
- **`label`** — 2–6 words. Shown in tooltips, detail panel, and node labels at high importance.
- **`date`** — signed integer year (negative = BCE) **or** an ISO 8601 string like `"1687-07-05"` for sub-year precision in the modern era. Dates are parsed by `parseEventYear()` in `src/lib/timeScale.ts`.
- **`domain`** — one of: `language`, `math`, `philosophy`, `physics`, `chemistry`, `life_sciences`, `medicine`, `earth_sciences`, `social_sciences`, `cs`, `engineering`. Drives both lane assignment and node color.
- **`description`** — 1–3 sentences, scholarly tone. Drawn from the detail panel with a serif drop cap. Not a Wikipedia clone; aim for *why this event mattered* rather than encyclopedic detail.
- **`importance`** — integer 1–5. Drives node size, label visibility, and the importance-threshold filter.

Optional fields:

- `dateUncertainty` — plus/minus in years. Use generously for prehistoric events.
- `subdomain` — free-form, displayed under the domain in the detail panel.
- `keyFigures` — array of names. Shown in the detail panel; matched by search.
- `frontier` — `true` for events that open an *ongoing* research area (CRISPR, transformers, quantum error correction, GLP-1, BCIs, etc.). Renders with a dashed border and gentle glow; the detail panel shows "Active — ongoing" instead of a terminal date.
- `sources` — placeholder for future citation strings.

Edges:

- **`source`**, **`target`** — must reference existing node ids. Invalid edges are silently dropped at load time.
- **`type`** — one of:
  - `enables` — solid line with a closed arrowhead. Foundational dependency. *Calculus → Classical mechanics.*
  - `influences` — dashed line. Conceptual borrowing, suggestive resemblance. *Information theory → Molecular biology.*
  - `refines` — solid line with an open diamond. Succession or replacement. *Newtonian mechanics → General relativity.*
- **`description`** — optional, 1–2 sentences. Shown when the related event appears in the detail panel's *Built on* / *Enabled* sections.

## Adding events

1. Open `public/events.json`.
2. Append a node to the `nodes` array. Pick a unique `id`. Choose the most defensible `domain` and a sensible `importance`.
3. Add edges to the `edges` array describing what this event was built on (incoming) and what it enabled (outgoing). Aim for 1–4 edges per non-trivial event — too few makes the graph sparse, too many makes the influence-chain mode unreadable.
4. Reload the page. The graph re-lays out automatically.

Tips:

- Keep descriptions short (1–3 sentences). The site is *not* a reference work; it's a map.
- Prefer "events" over "great people". A great figure usually maps to one or two events (a book, a discovery); list the names under `keyFigures`.
- For non-Western events, use the conventional English transliteration without diacritics so search works without IME tricks (e.g., `al-Khwarizmi`, `Ibn al-Haytham`, `Panini`, `Brahmagupta`).
- If you're unsure where an event goes, look at the curation guidance in `_meta.curationGuidance`. The seed deliberately prioritized medicine, social sciences, earth sciences, language, and non-Western depth.

## Architecture

```
src/
├── App.tsx                   # top-level layout, loads events.json
├── main.tsx                  # React entry
├── index.css                 # parchment palette, font rules
├── types.ts                  # RawEvent, RawEdge, EventNode, EdgeLink
├── data/
│   └── domains.ts            # 11 DomainConfig records + 5 ERAS
├── lib/
│   ├── timeScale.ts          # createEraScale: piecewise compression
│   ├── graph.ts              # ancestors / descendants / shortestPath
│   └── layout.ts             # node radius + in-lane jitter resolver
├── hooks/
│   ├── useEvents.ts          # fetch & validate events.json
│   ├── useUIState.ts         # selection, compare, filters, year window
│   └── useResponsive.ts      # viewport + ResizeObserver
└── components/
    ├── Header.tsx            # title + search bar
    ├── ControlsPanel.tsx     # domain checkboxes, importance, edges, legend
    ├── TimelineNetwork.tsx   # the SVG canvas (the big one)
    ├── NodeTooltip.tsx       # hover tooltip
    ├── DetailPanel.tsx       # right-hand detail panel + compare narrative
    ├── TimeScrubber.tsx      # histogram-backed bottom slider
    ├── Legend.tsx            # corner color legend
    └── MobileFallback.tsx    # era-list view for small screens
```

### Time scale

`createEraScale(rangeStart, rangeEnd, eras)` produces forward/inverse mappings from year ↔ pixel. Each era gets a slice of the X range proportional to its `share`. Inside an era the scale is linear, so within Antiquity (say) the relative spacing of Euclid (-300), Archimedes (-250), and Eratosthenes (-240) is preserved exactly.

When you drag the scrubber to a sub-range, the d3.zoom transform stretches that sub-range to fill the canvas — without changing the underlying era-compressed coordinate system. That preserves event positions inside the visible window in a natural, linear-feeling way ("semantic zoom"), and makes scrubber and pan/zoom share a single piece of state.

### Influence chain

`ancestors()` and `descendants()` are bounded BFS over the directed edge graph, with the depth bound coming from the UI. `shortestPath()` does undirected BFS for compare mode.

The graph index is built once per data load and reused across selection / hover / depth changes, so chain mode is interactive on a graph this size.

### Rendering performance

~366 nodes + ~412 edges renders comfortably in SVG. Edges off-screen are skipped; labels are only drawn for sufficiently important or selected nodes. There is no force layout — node positions are deterministic given the data, so the same event always lands in the same spot.

## Tech

- **Vite** for build tooling
- **React 18** + TypeScript
- **D3 v7** (`d3-zoom`, `d3-selection`) for pan/zoom, otherwise hand-rolled scales and layouts so the SVG is fully under React's control
- **Tailwind CSS** for styling, with a custom palette (`parchment`, `ink`, `domain.*`) defined in `tailwind.config.js`

The bundled output is ~233 KB JS + ~19 KB CSS, gzipped to ~75 KB JS + ~5 KB CSS.

## Curation principles

- ~300–500 nodes ceiling: a hard editorial constraint, not a technical one. Past ~500 the influence graph becomes a hairball.
- Balance across domains. The seed leaned physics/CS-heavy; this expansion pushed deliberately into medicine, earth sciences, social sciences, and language/communication, and tried to give serious weight to non-Western contributions (Chinese astronomy and medicine; Indian linguistics and mathematics; Islamic Golden Age scholarship; Mesoamerican mathematics; African metallurgy and tallies).
- Events, not "great men". Names are attributes (`keyFigures`), not nodes.
- Descriptions explain *why* an event mattered for what came next — that's the unit of influence the graph is trying to capture.

## License

MIT. See [LICENSE](LICENSE). The dataset itself is curated and best treated as opinionated — corrections and additions welcome.
