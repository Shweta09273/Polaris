# UI Design System — POLARIS Mission Control

**Inspiration (principles, not clones):** Palantir Foundry, Linear, Arc, Apple, Notion, Stripe, Google Earth Studio, NASA Mission Control.

**Theme:** Dark futuristic · Government-grade · Enterprise · Clarity over ornament.

---

## 1. Product Feel

Operators should feel they are in a **mission control center**, not a marketing site and not a generic analytics dashboard.

- Dense where needed, calm where possible
- Every control has an operational purpose
- Map / twin is the primary surface; chrome is secondary
- No emoji, no playful illustration, no purple SaaS clichés

---

## 2. Color Tokens

```css
:root {
  /* Atmosphere */
  --polaris-bg-0: #07090d;      /* deepest void */
  --polaris-bg-1: #0c1017;      /* app background */
  --polaris-bg-2: #121821;      /* panels */
  --polaris-bg-3: #1a2330;      /* elevated */

  /* Borders */
  --polaris-border-subtle: rgba(255, 255, 255, 0.06);
  --polaris-border-strong: rgba(255, 255, 255, 0.12);

  /* Text */
  --polaris-text-primary: #e8eef7;
  --polaris-text-secondary: #9aa8bc;
  --polaris-text-tertiary: #6b7a8f;
  --polaris-text-inverse: #0c1017;

  /* Brand signal — cold signal cyan, not purple */
  --polaris-accent: #3de1ff;
  --polaris-accent-muted: rgba(61, 225, 255, 0.14);
  --polaris-accent-strong: #1ab8d4;

  /* Semantic */
  --polaris-ok: #3dd68c;
  --polaris-warn: #f5c542;
  --polaris-critical: #ff5c5c;
  --polaris-info: #6ea8fe;

  /* Layer legend hues (desaturated, distinct) */
  --polaris-layer-road: #8fa3b8;
  --polaris-layer-building: #c4b59a;
  --polaris-layer-hydro: #4f8fbb;
  --polaris-layer-hazard: #e07a3d;
  --polaris-layer-critical: #e8eef7;
}
```

**Rules**

- No large purple-to-indigo gradients
- No warm cream paper themes
- Glassmorphism **only** on floating inspector panels over the map (blur ≤ 12px, opacity ≤ 0.72)
- Prefer solid panels elsewhere

---

## 3. Typography

Avoid Inter / Roboto / Arial / system-ui as brand faces.

| Role | Font | Notes |
|---|---|---|
| Display / Brand | **IBM Plex Sans** (Semibold) or **Satoshi** | Clean, institutional |
| UI / Body | **IBM Plex Sans** | Excellent denseness for ops UI |
| Mono / Telemetry | **IBM Plex Mono** | Coordinates, IDs, logs |
| Map labels | MapLibre style with Plex where possible | Keep legible at tilt |

Scale (rem @ 16px root):

| Token | Size | Weight | Use |
|---|---|---|---|
| `display` | 32 / 40 | 600 | Rare — AOI title in command header |
| `title` | 20 / 28 | 600 | Panel titles |
| `body` | 14 / 20 | 400 | Default |
| `body-strong` | 14 / 20 | 550 | Emphasized labels |
| `caption` | 12 / 16 | 400 | Metadata, provenance |
| `micro` | 11 / 14 | 500 | Badges, layer tags |

Letter-spacing: slightly open on all-caps micro labels (`0.04em`).

---

## 4. Layout Geometry

```
┌────────────────────────────────────────────────────────────┐
│ TOP COMMAND BAR — brand mark · workspace · AOI · status    │
├──────────┬─────────────────────────────────────┬───────────┤
│ LEFT     │                                     │ RIGHT     │
│ NAV RAIL │         TWIN VIEWPORT               │ INSPECTOR │
│ layers   │         (MapLibre / Cesium)         │ selection │
│ modules  │         full-bleed, edge-to-edge    │ provenance│
│          │                                     │ actions   │
├──────────┴─────────────────────────────────────┴───────────┤
│ BOTTOM TIMELINE / OBSERVATION STRIP (collapsible)          │
└────────────────────────────────────────────────────────────┘
```

**Rules**

- First viewport = one composition: twin viewport dominant
- Brand mark is visible and decisive in the command bar (not tiny favicon-only)
- No card grids in the hero/workspace
- No stat strips competing with the map on first load
- Cards allowed only for interactive decision briefs / job forms later

---

## 5. Components (purpose-built)

| Component | Purpose |
|---|---|
| `CommandBar` | Workspace context, AOI switcher, env health |
| `NavRail` | Module switch: Twin, Catalog, Ingestion, Graph, Simulations (disabled until ready), Decisions (disabled) |
| `LayerTree` | Authoritative layers with freshness + license badges |
| `TwinViewport` | Map/globe; selection; measure |
| `Inspector` | Entity details, provenance, graph neighbors |
| `TimelineStrip` | Temporal observations & scenario clock |
| `StatusPill` | System health (ingestion lag, API, graph sync) |
| `ProvenanceBadge` | Source · license · dataset version |
| `EmptyTruthState` | When data missing — states the gap honestly (never fake geometry) |
| `JobConsole` | Ingestion / simulation job logs (monospace) |

Disabled modules remain visible but locked with tooltip: “Available after Milestone N”.

---

## 6. Motion

Ship intentional motion only:

1. **Panel enter:** 160ms opacity + 8px translate (ease-out)
2. **AOI focus:** camera ease 600–900ms to bounds
3. **Selection pulse:** 1 soft ring on selected asset (no perpetual glow spam)

Prefer reduced-motion media query respect.

---

## 7. Iconography

- Stroke icons 1.5px, 24px grid (Lucide or custom set)
- No filled candy icons
- Critical facilities use restrained geometric marks on map

---

## 8. Content Tone

- Precise, calm, technical
- Prefer “No DatasetVersion for flood zones in this AOI” over empty illustrations
- Always show units, timestamps (UTC), CRS when spatial

---

## 9. Accessibility

- WCAG AA contrast on text
- Focus rings: `--polaris-accent` 2px
- Keyboard: layer tree, inspector, command palette (`⌘K`)
- Do not convey state by color alone

---

## 10. Implementation Location

- Tokens & primitives: `packages/design-system`
- App shell: `apps/web/src/components/shell`
- Global CSS variables: `apps/web/src/styles/tokens.css`

---

## 11. Anti-Patterns (reject in review)

- Purple gradient marketing hero
- Bento card dashboards as home
- Fake KPIs (“142 hospitals”) without Catalog backing
- Soft neumorphism
- Rainbow choropleths without legend/units
- Glass everywhere
