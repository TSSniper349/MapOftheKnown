# Map of the Known &mdash; v2

A coordinated, four-lens map of human knowledge: events on a time-axis network, on a geographic map, in a people-graph, and as a concept tree. From the emergence of language (~150,000 years ago) to the research frontiers of 2026.

**366 events · 417 influences · 11 domain lanes · 4 coordinated views**

---

## Run it

```bash
npm install
npm run dev        # local dev server (http://localhost:5173)
npm run build      # production build → dist/
npm run preview    # serve the production build
npm run typecheck
```

The site is static and deploys to Vercel, Netlify, GitHub Pages, or any static host.

## The four views

| Key | View | What it shows |
|---|---|---|
| 1 | **Time-axis** | The default. X = compressed time, Y = ~11 domain lanes. Per-lane density stripes show *when* each field exploded; semantic zoom controls label density (Globe / Continent / Country / Street). Press `Space` to animate playback. |
| 2 | **Geographic** | Equal Earth projection with markers colored by domain. Multi-location events (parallel discoveries, multi-civilizational developments) appear as multiple markers connected by a dotted line. Zoom out to see country-level pie clusters. |
| 3 | **People** | Force-directed graph of canonicalized `keyFigures`. Nodes are people sized by total importance, colored by their most-frequent domain. Edges are co-event ties. Lineages (Hilbert → von Neumann → Shannon) become visible. |
| 4 | **Concepts** | Concept tags grouped by their dominant domain. Click a tag to highlight every event carrying it across all views. |

Selection is shared global state. Click an event in the time-axis, switch to the map (`2`) — the same event is highlighted, its location pinned. Click its key figure in the detail panel and you teleport to the people-graph. The bottom-left **selection breadcrumb** shows what is currently selected and clears it with one tap.

## Interactions

Mouse:
- Pan, scroll-zoom, click an item for detail.
- Shift-click two events to enter compare mode (shortest influence path drawn as a narrative chain).
- Hover an edge for its relationship description.

Keyboard:
- `1` / `2` / `3` / `4` — switch view.
- `/` — focus search.
- `↵` — **teleport**: select the matching event, zoom the time-axis to a 150-year window centered on it, briefly pulse the node.
- `I` — toggle influence-chain mode (ancestors blue, descendants amber, depth slider in the detail panel).
- `E` — toggle all edges.
- `Space` — play / pause time-axis animation.
- `←` / `→` — step the time window.
- `Esc` — clear selection / exit mode.

## Visual aesthetic

- Warm parchment background (`#FAF7F2`) with a faint grain.
- EB Garamond serif for prose, labels, era names. Inter sans for UI chrome.
- A muted-jewel domain palette retuned for **WCAG AA against the parchment**, with explicit attention to Deuteranopia / Protanopia distinguishability — the v1 Life Sciences / Earth Sciences green collision and the Physics / CS navy-teal collision are gone.
- Frontier events have a dashed border and a gentle outward glow.
- Selected nodes get a **parchment-colored halo** before their colored border — selection reads clearly against any background.
- The in-canvas legend that overlapped the Physics lane in v1 has been removed; the sidebar legend is the single source.

## Time scale &amp; semantic zoom

Linear time across 150,000 years is unreadable. X uses **piecewise compression** so each era gets comparable screen space at default zoom:

| Era | Range | Default share |
|---|---|---|
| Prehistory | ~150,000 BCE – 3000 BCE | 13% |
| Antiquity | 3000 BCE – 500 CE | 16% |
| Medieval / Early Modern | 500 – 1700 | 18% |
| Modern | 1700 – 1900 | 18% |
| Contemporary | 1900 – 2026 | 35% |

Inside each era the scale is linear, so relative ordering and spacing are preserved.

**Four semantic-zoom levels** drive label density on the time-axis:

| Level | Visible span | Labels | Edges |
|---|---|---|---|
| L0 Globe | > 5,000 years | top importance-5 only | hidden by default |
| L1 Continent | 500 – 5,000 years | importance ≥ 4 | ~6% opacity |
| L2 Country | 50 – 500 years | importance ≥ 3 | ~12% opacity |
| L3 Street | < 50 years | all + description preview for importance ≥ 4 | ~22% opacity |

A status indicator in the top-right shows the current level.

## Data schema (v2)

Events live in [`public/events.json`](public/events.json):

```json
{
  "id": "evt_015_calculus",
  "label": "Differential and integral calculus",
  "date": 1675,
  "dateUncertainty": 10,
  "domain": "math",
  "subdomain": "calculus",
  "description": "Independent invention by Newton (fluxions) and Leibniz (differentials)…",
  "keyFigures": ["Isaac Newton", "Gottfried Wilhelm Leibniz"],
  "locations": [
    { "label": "Cambridge, England", "lat": 52.20, "lon": 0.12 },
    { "label": "Hanover, Holy Roman Empire", "lat": 52.37, "lon": 9.73 }
  ],
  "concepts": ["derivative", "integral", "infinitesimal", "limit"],
  "importance": 5,
  "frontier": false,
  "sources": []
}
```

**v2 additions:**

- **`locations[]`** — array of `{ label, lat, lon }`. Empty allowed for events without a meaningful geographic anchor (e.g. emergence of symbolic language, the modern synthesis). Multi-civilizational events (the agricultural revolution, iron smelting) have one entry per origin.
- **`concepts[]`** — controlled vocabulary tags, **lowercased, hyphenated**. They drive the concepts view, search, and cross-view filtering.

**Canonicalization rules** (the builder must enforce these when adding events):

- `keyFigures` strings are matched **exactly** across events. `"Newton"`, `"Isaac Newton"`, and `"I. Newton"` are three different people unless normalized. This dataset uses the full conventional English transliteration without diacritics everywhere — keep the discipline.
- `concepts` strings are matched **exactly**. `"natural-selection"` ≠ `"natural selection"` ≠ `"naturalSelection"`. Use the same tag everywhere you mean the same idea, lowercased and hyphenated.

Required fields: `id`, `label`, `date`, `domain`, `description`, `importance`. The rest are optional but strongly recommended for full functionality.

### Edges (v2)

Edge types expanded from 3 to 5:

| Type | Line style | Meaning |
|---|---|---|
| `enables` | solid + arrow | Foundational dependency. *Calculus → Newtonian mechanics.* |
| `refines` | solid + open diamond | Succession / supersedure. *Newton → Einstein.* |
| `influences` | dashed | Conceptual borrowing. *Information theory → molecular biology.* |
| `synthesizes` | solid + filled-circle marker | One event explicitly combines two priors. May use `sources: ["evt_a", "evt_b"]` for the two-source case. *Modern synthesis = Darwin + Mendel.* |
| `parallel` | dotted, no arrow | Independent simultaneous discovery / structurally parallel events. *Evolution and plate tectonics each unified their fields by replacing static taxonomies with dynamics.* |

Schema:

```json
{ "source": "evt_a", "target": "evt_b", "type": "enables", "description": "…" }
{ "sources": ["evt_a", "evt_b"], "target": "evt_c", "type": "synthesizes", "description": "…" }
```

### Derived tables (computed at load)

The people-graph, the place clusters, and the concept tree are all **derived** at load time from the events themselves. No author-time files needed. `src/lib/derive.ts` does the work:

- **People** &mdash; one record per canonicalized `keyFigures` string, with their events, total importance, primary domain, and date span.
- **Places** &mdash; one record per `(lat, lon)` rounded to 2 decimals, with the events located there.
- **Concepts** &mdash; one record per concept tag, with its events, dominant domain, date span, and whether any of its events are `frontier: true`.

## Adding events

1. Open `public/events.json`.
2. Append a node. Pick a unique `id`, a defensible `domain`, an `importance` (1–5).
3. **Reuse existing concept tags** where you can — search for the tag you want to use in other events. The concept tree quality is *only as good as canonicalization discipline*.
4. **Reuse existing `keyFigures` strings** by exact match. The people-graph is brittle to name variation; "Charles Darwin" everywhere, not "Darwin" or "C. Darwin".
5. Add `locations` accurately. The geographic view will reveal Eurocentric blind spots in real time — that's the point.
6. Add edges describing what this event was built on (incoming) and what it enabled (outgoing). 1–4 edges per non-trivial event.
7. Reload.

### Adding a concept hierarchy (optional)

The brief allows an authored `concepts.json` for tree structure. It is **not required**; without it the concept view groups concepts by their dominant domain (the current default). If you decide to author one, the shape is:

```json
{
  "concepts": [
    { "id": "computation", "parent": null, "label": "Computation" },
    { "id": "neural-network", "parent": "computation", "label": "Neural network" },
    { "id": "attention", "parent": "neural-network", "label": "Attention mechanism" }
  ]
}
```

Drop it in `public/concepts.json`. (Not wired up in this revision; left for v2.1.)

### Colorblind testing

The 11-color palette in `src/data/domains.ts` was selected to pass WCAG AA against the parchment background and to remain distinguishable under common color-vision deficiencies. To verify after a palette edit:

1. Open `npm run dev` in Chrome.
2. DevTools → Rendering pane → Emulate vision deficiencies → Protanopia / Deuteranopia / Tritanopia.
3. Sample the time-axis legend and the map; adjacent lane swatches must still read as distinct.

## Architecture

```
src/
├── App.tsx                   # View router; loads events.json
├── main.tsx
├── index.css
├── types.ts                  # v2 schema types (RawEvent, RawEdge, Location, etc.)
├── data/domains.ts           # 11-color palette + ERAS
├── lib/
│   ├── timeScale.ts          # piecewise era-compressed scale
│   ├── graph.ts              # ancestors / descendants / shortestPath
│   ├── layout.ts             # node radius + in-lane jitter resolver
│   └── derive.ts             # people / places / concepts tables + person-edge builder
├── hooks/
│   ├── useEvents.ts
│   ├── useUIState.ts         # view, selection, pin, playback, teleport, etc.
│   └── useResponsive.ts      # ResizeObserver with synchronous initial measurement
├── components/
│   ├── Header.tsx            # title + Enter-to-teleport search
│   ├── ViewTabs.tsx          # 4-tab view router
│   ├── ControlsPanel.tsx     # domains, importance, edges, legend
│   ├── TimelineNetwork.tsx   # the time-axis view (semantic zoom + density stripes + playback)
│   ├── NodeTooltip.tsx
│   ├── DetailPanel.tsx       # right-hand pinnable detail + compare narrative
│   ├── TimeScrubber.tsx      # bottom slider + play button + era quick-jumps
│   ├── SelectionBreadcrumb.tsx
│   └── MobileFallback.tsx
└── views/
    ├── GeographicView.tsx    # Equal Earth + d3-geo + topojson land
    ├── PeopleView.tsx        # d3-force people-graph
    └── ConceptView.tsx       # domain-grouped concept tags

public/
├── events.json               # 366 events, 417 edges
├── topojson/world-50m.json   # simplified land outline for the geographic view
└── favicon.svg
```

## Tech

- **Vite** for build tooling
- **React 18** + **TypeScript** (strict)
- **D3 v7** for `d3-zoom`, `d3-geo` (Equal Earth), `d3-force`, `d3-hierarchy`-style derivations
- **topojson-client** + **world-atlas** for the simplified land outline (~50 KB)
- **Tailwind CSS** with a custom palette (`parchment`, `ink`, `domain.*`) in `tailwind.config.js`

Bundle: ~298 KB JS + ~21 KB CSS, gzipped to ~96 KB JS + ~5 KB CSS.

## Performance

- Time-axis renders all ~366 nodes in SVG at 60fps on a 5-year-old laptop.
- The geographic view caches its TopoJSON after first fetch (~55 KB).
- The people-graph runs d3-force with `alphaDecay: 0.04` and 90-strength charges; the simulation settles in ~3 seconds.
- The concept view is a static grouped-tags grid — no simulation cost.

## Curation principles

- ~300–500 events is an editorial constraint, not a technical one. Past ~500 the influence graph becomes a hairball.
- **Balance across domains.** The seed leaned physics/CS-heavy; this expansion pushed deliberately into medicine, earth sciences, social sciences, and language — and gave serious weight to non-Western contributions: Chinese astronomy and medicine (Zhang Heng, Huangdi Neijing, Shen Kuo, Su Song), Indian linguistics and mathematics (Pāṇini, Aryabhata, Brahmagupta, Madhava), Islamic Golden Age scholarship (al-Khwarizmi, al-Haytham, al-Razi, Avicenna, al-Biruni, Omar Khayyam, Ibn al-Nafis, Ibn Khaldun), Mesoamerican mathematics (Maya zero, Long Count), African metallurgy and tallies (Lebombo, Ishango, Nok iron).
- **Events, not "great men".** Names are attributes (`keyFigures`), not nodes. The people-graph derives them automatically.
- Descriptions stay 1–3 sentences and explain *why* the event mattered for what came next — that's the unit of influence the graph is trying to capture.

## License

MIT. See [LICENSE](LICENSE). The dataset itself is curated and best treated as opinionated — corrections and additions welcome.
