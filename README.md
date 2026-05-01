# PM Roadmap Scorer

Local-only prototype that helps Drew (PM for Application + Profiles at RudderStack)
score and sequence features pulled from Notion without the noise of the production
Notion databases. Scoring stays here; final calls (Committed / Icebox) are written
back to the Hopper via the in-app **Sync To Hopper** button.

## Vision / use case

Drew's day-to-day lives in two Notion databases:

- **The Hopper** ("Share your idea!") — catchall intake for any internal or
  external idea. Operationally critical but messy.
- **Feature Pipeline Database** — the features we've committed to build; tracks
  full lifecycle from Idea Gathering → Release → Post Validation.

When inheriting a set of AoRs (currently **Application** and **Profiles**), mid-process
orientation is hard: both DBs carry hundreds of records and dozens of columns
owned by multiple PMs, engineers, and stages. This app pulls only Drew-assigned
records, strips the noise, and gives a single surface for comparative scoring,
follow-up tracking, and committed-vs-iceboxed decisioning.

The workflow:

1. Sync Drew-assigned records from Notion into the app (one-click for Hopper;
   MCP-assisted for Feature DB + ARR — see below).
2. Flag anything that needs follow-up before scoring.
3. Score each feature on 7 strategic booleans + an ARR decimal.
4. Decide: leave in Reviewing, mark **Committed**, or **Icebox**.
5. Tag back to Notion via the **Sync To Hopper** button — pushes Committed /
   Icebox decisions to Hopper rows and creates Feature DB entries for newly
   committed items.

## Schema (app-side)

This app **does not mirror** the Notion schemas. Those are the source of noise
we're escaping. In-app schema (`src/types.ts`):

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Stable app-side id |
| `name` | string | Feature title (from Notion title; editable) |
| `aor` | `'Application' \| 'Profiles' \| null` | Best-guess on import, user-editable |
| `arr` | number | $ ARR attached to the feature (Hopper backfill via `scripts/merge-hopper-arr.mjs`; Feature DB via MCP customer-rollup reconstruction) |
| `scores.is_apart_of_company_strategy` | boolean | UI: "Strategy" |
| `scores.attached_to_company_ost` | boolean | UI: "OST" |
| `scores.minimize_churn` | boolean | UI: "Churn Prevention" |
| `scores.operationally_critical` | boolean | UI: "Ops Critical" |
| `scores.customer_ask` | boolean | UI: "Customer Ask" |
| `scores.increase_arr` | boolean | UI: "ARR Driver" |
| `scores.competitor_parity` | boolean | UI: "Competitor Parity" |
| `needsFollowUp` | boolean | Item needs PM follow-up before scoring |
| `followUpNote` | string? | Free-text "why?" attached to the follow-up flag |
| `planningStatus` | `'committed' \| 'icebox' \| null` | `null` = Reviewing. Drives KPI scorecards, Status filter, and row dimming. |
| `source` | `'hopper' \| 'feature' \| 'manual'` | Where the row came from |
| `notionUrl` | string? | Link back to the Notion record; also the dedup key on Sync From Hopper |

**Computed:** `Score` = sum of the 7 booleans (0–7).

**Default sort:** Score descending, ARR descending tiebreak. Click any of the
**#**, **Score**, or **ARR** column headers to switch sort key or toggle
asc/desc. The active column shows a filled arrow; clicking the same column
again flips direction.

## Architecture

There are now **two paths** to get data in. The Hopper path is fully in-app;
Feature DB + ARR rollup reconstruction still goes through the MCP-assisted
flow because those Notion shapes are messier and we haven't rebuilt them yet.

### Primary: Sync From Hopper (in-app, one click)

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (App.tsx → SyncFromHopperCard)                        │
│    fetch('/api/notion/v1/databases/<id>/query', POST)          │
└──────────────────────────┬─────────────────────────────────────┘
                           │  no Authorization header at this hop
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Vite dev server proxy  (vite.config.ts → server.proxy)        │
│    rewrites /api/notion → https://api.notion.com               │
│    injects Authorization: Bearer ${NOTION_TOKEN}               │
│    injects Notion-Version: 2022-06-28                          │
└──────────────────────────┬─────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Notion REST API (api.notion.com)                              │
│    server-side filter: Area PM = Drew                          │
│                        AND Hopper Stages NOT IN {Icebox,       │
│                        Duplicate, To Feature DB}               │
│    cursor pagination until has_more = false                    │
└──────────────────────────┬─────────────────────────────────────┘
                           │  full result set
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  src/lib/notionSync.ts → mergeHopperRows()                     │
│    dedup by notionUrl                                          │
│    new rows: scores all false, arr=0, status=null, AoR guess   │
│    existing rows: untouched (no overwrite)                     │
│    prepend new rows to features[]                              │
└──────────────────────────┬─────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Browser localStorage (auto-saves on every change)             │
│    pm-roadmap-app:features:v1     → Feature[]                  │
│    pm-roadmap-app:strategies:v1   → ContextItem[] (left bar)   │
│    pm-roadmap-app:osts:v1         → ContextItem[] (left bar)   │
│    pm-roadmap-app:layoutWidth:v1  → number (page max-width)    │
│    pm-roadmap-app:nameColWidth:v1 → number (Feature col width) │
│    pm-roadmap-app:theme:v1        → 'light' | 'dark'           │
└────────────────────────────────────────────────────────────────┘
```

The token lives only in `.env.local` (gitignored via the existing `*.local`
rule). It's read by `loadEnv` in `vite.config.ts`, which runs in Node — never
in the browser bundle. Verify with `grep -r "secret_" dist/` after a build.

### Legacy: Feature DB + ARR (MCP-assisted)

```
┌──────────────────────────────────────────────────────────────────┐
│  Notion workspace                                                 │
│  ├── Feature Pipeline DB   (PM Owner = Drew — many views)         │
│  └── Current Customers DB  (ARR per customer, related to Feature) │
└────────────────────┬─────────────────────────────────────────────┘
                     │ Claude queries via Notion MCP
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Tool-result files (ephemeral, in Claude's tmp dir)               │
└────────────────────┬─────────────────────────────────────────────┘
                     │ scripts/build-seed.mjs (+ ARR reconstruction)
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  data/seed.json  → click "Import JSON" in UI (replaces state)     │
└──────────────────────────────────────────────────────────────────┘
```

This path is still the only way to get **Feature DB rows** and to reconstruct
the **Combined ARR rollup** (the MCP omits rollup values, so we fetch related
customer pages and sum). Hopper rows should now come via the in-app button —
the MCP Hopper steps are documented below for reference but are no longer the
recommended flow.

**Stack:** Vite + React + TypeScript + Tailwind v3. No backend in the production
sense — the Vite dev server doubles as the Notion proxy. Persistence is browser
`localStorage`, with JSON import/export as a manual safety valve.

### Project layout

```
pm-roadmap-app/
├── src/
│   ├── App.tsx                         # top-level state, filters, sidebar wiring
│   ├── types.ts                        # Feature, Scores, PlanningStatus, ContextItem, SCORING_KEYS
│   ├── storage.ts                      # localStorage + JSON/CSV import/export
│   ├── sampleData.ts                   # "Load sample" seed
│   ├── lib/
│   │   ├── notionSync.ts               # Hopper pull client + mergeHopperRows
│   │   └── notionSyncToHopper.ts       # Hopper write-back client
│   └── components/
│       ├── TopBar.tsx                  # KPI cards, sync card, filters, action buttons
│       ├── KpiScorecard.tsx            # Uncommitted / Iceboxed / Committed display tiles
│       ├── SyncFromHopperCard.tsx      # idle/loading/success/error pull card
│       ├── SyncToHopperCard.tsx        # idle/loading/success/error push card
│       ├── FeatureTable.tsx            # main scoring grid (sort, resize, inline-edit)
│       ├── ContextCard.tsx             # left-sidebar list (Strategies / OSTs)
│       ├── ContextItemModal.tsx        # add-strategy / add-OST modal
│       ├── AddFeatureModal.tsx         # manual feature creation
│       └── ThemeToggle.tsx             # dark/light toggle
├── scripts/
│   ├── build-seed.mjs                  # legacy: Notion MCP tool-result → data/seed.json
│   └── merge-hopper-arr.mjs            # merge user-provided ARR CSV into seed.json
├── data/
│   └── seed.json                       # last MCP sync output (do not commit if sensitive)
├── public/
│   └── favicon.svg
├── .env.local.example                  # template for NOTION_TOKEN + VITE_NOTION_HOPPER_DB_ID
├── vite.config.ts                      # /api/notion proxy with token injection
└── tailwind.config.js                  # RudderStack palette + Inter fallback
```

**Styling:** RudderStack palette pulled from the visual style guide
(Primary-50 → Primary-900, accent colors). PolySans isn't freely licensed, so
headings fall back to Inter. Dark mode is class-based (`dark:` Tailwind
utilities), driven by `pm-roadmap-app:theme:v1` in localStorage.

## UI behaviors worth knowing

### Top bar

- **Title block** — "Roadmap Scorer" + subtitle showing filtered count and total ARR.
- **KPI scorecards** (display-only, not buttons; icons are PNGs in `public/`):
  - **Uncommitted** (`loading.png`) — count of features with `planningStatus === null`
  - **Iceboxed** (`ice-bucket.png`) — count of features with `planningStatus === 'icebox'`
  - **Committed** (`check.png`) — count of features with `planningStatus === 'committed'`
- **Sync From Hopper** card (soft indigo background, `loop.png` icon) — pulls
  new Hopper rows into the app. Four states:
  - **idle** — "Pull new records"
  - **loading** — animated spinner on the right; "Syncing…"
  - **success** — `N new · N updated · N returned`
  - **error** — red text with the API status message; tooltip shows full error
- **Sync To Hopper** card (soft green background, `sync.png` icon) — writes
  planning decisions back to Notion. Four states:
  - **idle** — "Push decisions to Notion"
  - **loading** — spinner; "Syncing…"
  - **success** — `N created · N committed · N iceboxed` (tooltip shows full
    breakdown including skipped rows)
  - **error** — red text with the API status message
- **Action buttons** (right side of header row):
  - **Load sample** — replaces board with synthetic data (no confirm; tooltip warns)
  - **Clear board** — drops all front-end records (no Notion writeback; tooltip warns)
  - **Import JSON** / **Export JSON** / **Export CSV** — import replaces (with confirm); exports are non-destructive
  - **+ Add feature** — manual row entry
- **Filter row** (below):
  - **AoR** — All / Application / Profiles
  - **Follow-up** — All / Needs follow-up / Ready
  - **Source** — All / Hopper / Feature DB / Manual
  - **Status** — All / Reviewing / Committed / Icebox  (Reviewing = `planningStatus === null`)
- **Right-side actions**:
  - **Theme toggle** — dark/light, persisted
  - **Reset width** — only appears when the page layout has been resized
  - **Icebox Uncommitted (N)** — bulk-move every Reviewing row to Icebox (with confirm)
- **Search** — substring match on feature name

### Left sidebar (visible at `xl` breakpoint and up)

Two stacked, sticky context cards meant to keep strategic context in view
while you score:

- **Company strategies** — freeform `{ title, description }` items. Add via "+ Add", delete per item.
- **OSTs** — same shape, separate list (Objectives, Solutions, Tactics).

Both lists persist independently in localStorage and never leave the browser.

### Feature table — columns in render order

1. **#** — row number (sortable)
2. **Feature** — editable name; "open in Notion" link below if `notionUrl` present; column is resizable (drag the right edge of the header; min 180, max 900, default 420; persisted)
3. **AoR** — dropdown: blank / Application / Profiles
4. **Follow-up** — checkbox + inline "why?" note input (only the checkbox toggles `needsFollowUp`; the note edits `followUpNote`)
5. **Strategy** / **OST** / **Churn Prevention** / **Ops Critical** / **Customer Ask** / **ARR Driver** / **Competitor Parity** — 7 scoring checkboxes
6. **Score** — computed chip (sortable). Color: 5+ green, 3–4 blue, 1–2 neutral, 0 muted
7. **ARR** — number input (sortable; tiebreak to Score in default sort)
8. **Source** — chip (sortable). Color: hopper light-purple, feature blue, manual gray
9. **Status** — dropdown: blank / Committed / Icebox. Iceboxed rows dim to ~60% opacity and brighten on hover.
10. **✕** — delete

### Page-level

- **Layout width** — drag handle on the right edge of the page; double-click to reset; persisted in `pm-roadmap-app:layoutWidth:v1`. Default 2100, min 1280, capped to viewport width minus 48.
- **No undo** — use **Export JSON** as a checkpoint before risky actions.

## Getting data in — Sync From Hopper (primary)

### One-time Notion setup

1. **Create an internal integration** at https://www.notion.so/profile/integrations.
   - Type: **Internal**
   - Associated workspace: **rudderstacks**
   - Capabilities: **Read content**, **Update content** (reserved for the upcoming Sync To Hopper button), **Read user information without email addresses**
   - Some workspaces restrict integration creation to admins; if you see "You don't have permission to create integrations," ask the rudderstacks workspace owner to create it on your behalf and hand you the **Internal Integration Secret** via 1Password / Slack DM.
2. **Connect the integration to the Hopper DB** in Notion: open the Hopper page → `···` → **Connections** → search for the integration → **"this page only"** scope. The integration cannot see anything else in rudderstacks unless explicitly connected.
3. **Copy the env template and paste the secret**:
   ```bash
   cp .env.local.example .env.local
   # then open .env.local and set NOTION_TOKEN=secret_...
   ```
4. **Restart `npm run dev`.** Vite reads `.env.local` only at startup; the proxy won't have the token until you restart.

### Click the button

Click **Sync From Hopper** in the top bar. The card shows a spinner on the
right while the request runs, then updates to a result line:
`N new · N existing · N returned`.

- **Filter applied** (server-side, in the request body):
  `Area PM contains <Drew's user ID>` AND `Hopper Stages` NOT IN
  {`Icebox`, `Duplicate`, `To Feature DB`}.
  Drew's user ID is hardcoded in `src/lib/notionSync.ts`; replace it if a
  different PM uses the app.
- **Pagination** — the real REST API exposes a `next_cursor`, so we loop until
  `has_more = false`. No 100-record cap (unlike the MCP).
- **Merge semantics** — dedup by `notionUrl`. Existing rows are never
  overwritten — your scoring, AoR edits, follow-up notes, and planning status
  are preserved. Only net-new rows are prepended.
- **AoR best-guess on import** — `Product Area === Profiles` → `'Profiles'`,
  else `'Application'`. User-editable in the table.
- **Net-new rows always start fresh**: scores all `false`, `arr: 0`,
  `needsFollowUp: false`, `planningStatus: null`. The point of the app is for
  the PM to fill these in.

### Security model

- Token lives only in `.env.local` (gitignored via `*.local` in `.gitignore`).
- `loadEnv` reads it in Node; the `proxyReq` handler on `vite.config.ts:server.proxy['/api/notion']` injects `Authorization: Bearer ${NOTION_TOKEN}` per request.
- Browser → Vite is `localhost:5173` only. The browser bundle never sees the token.
- Notion DB IDs (e.g. `VITE_NOTION_HOPPER_DB_ID`) are **not** sensitive on their own — auth is per-token, not per-URL — and are exposed to the client via `import.meta.env`.
- Verify after a build: `grep -r "secret_" dist/` should return nothing.

## Getting data in — Feature DB + ARR (legacy MCP path)

Still required for **Feature DB rows** and for reconstructing the
**Combined ARR rollup** that the MCP omits. Run this with Claude Code via the
Notion connector.

### Prerequisites (one-time)

- Notion connector enabled in Claude Code.
- Authenticated as Drew Dodds (so `PM Owner = me` works).

### Every sync (conversational loop with Claude)

Tell Claude:

> Sync the Feature DB for Drew. Stages: Validation & Research, Product Refinement,
> Technical Refinement, Development. Then reconstruct ARR from the Customer List
> relations.

Claude will:

1. Resolve Drew's Notion user ID via `notion-search`. Current value:
   `eac00464-c24f-4d39-ae97-5576db9bc9bb`.
2. Query **Feature DB** via **multiple views** and union by Notion URL.
   Individual views don't filter by PM Owner server-side, and each view hits
   the 100-record cap; unioning views with different sorts is how we reach the
   full set. Recently used views:
   - Drew's View: `?v=305f2b415dd080cbb1aa000c1e0559a4`
   - All Features: `?v=290f2b415dd080b98c04000cc79ad637`
   - Prioritized Roadmap: `?v=2cbf2b415dd08082b3e1000c725653b9`
   - Two more: `?v=2a3f2b415dd08030af6a000c05dfba67`, `?v=30df2b415dd080cc8442000c8cdb3151`
3. Post-filter client-side to keep only Drew's rows in the four active stages
   (`4. Validation & Research`, `6. Product Refinement`, `7. Technical Refinement`, `9. Development`).
4. Run `node scripts/build-seed.mjs --feature <f1.txt> --feature <f2.txt> ...`
   to normalize and write `data/seed.json`.
5. For each Feature DB row, fetch its `Customer List` relation pages and sum
   their `ARR` values. Patch `data/seed.json` with the reconstructed
   `Combined ARR`.
6. (Optional, Hopper ARR backfill) Hand Claude a `notion_url,arr` CSV; run
   `node scripts/merge-hopper-arr.mjs` to patch ARR onto already-synced Hopper
   rows in `data/seed.json` by `notionUrl`.

Then in the browser: **Clear board** → **Import JSON** → pick `data/seed.json`.

### Important caveats (MCP path only)

- **100-record cap.** `notion-query-database-view` returns at most 100 records per call. No cursor exposed by the MCP. Workaround: union multiple views.
- **Rollups are omitted.** Both `notion-query-database-view` and `notion-fetch` return rollup values as `"<omitted />"`. That's why we reconstruct `Combined ARR` from per-customer fetches.
- **Import replaces** — wipes the in-app state. Use **Export JSON** first if you've already scored.
- **AoR best-guess is a guess** — same `Profiles`-keyword heuristic; verify in the app and fix any misses before scoring.
- **No writeback** to Notion (yet — see roadmap).

## Filter logic (as currently implemented)

| Source | Kept if | Dropped if |
|---|---|---|
| Hopper (in-app sync) | `Area PM` contains Drew AND `Hopper Stages` NOT IN {`Icebox`, `Duplicate`, `To Feature DB`} | All other stages |
| Feature DB (MCP path) | `PM Owner` contains Drew AND `Pipeline Stage` IN {`4. Validation & Research`, `6. Product Refinement`, `7. Technical Refinement`, `9. Development`} | All other stages |

Hopper filters live in `src/lib/notionSync.ts` (`HOPPER_DROP_STAGES`).
Feature DB filters live in `scripts/build-seed.mjs` (`FEATURE_KEEP_STAGES`).

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produces dist/
```

The **Sync From Hopper** button requires `.env.local` to be populated and
`npm run dev` to be running (the proxy is dev-server-only). Without those,
the button will surface a clear error.

## Roadmap / what's next

- **Hopper ARR auto-merge** — fold the CSV step (`merge-hopper-arr.mjs`) into
  the in-app sync, so ARR comes down with the rest of the row.
- **Feature DB sync via the proxy** — replace the MCP loop with an in-app
  button mirroring Sync From Hopper.
- **CSV import** (currently export-only).
- **Undo** — would let us drop the "Export JSON as a checkpoint" caveat.

## Known limitations

- **Single browser instance / single user** — `localStorage` is not shared.
- **No undo.** Use **Export JSON** for checkpoints before risky actions.
- **CSV is export-only** today (no CSV import).
- **Hopper sync requires `npm run dev`** — the proxy is a dev-server feature.
- **Workspace admin gate** — some Notion plans restrict integration creation to admins; you may need to ask the rudderstacks owner to create the integration on your behalf.
- **Feature DB still goes through the legacy MCP path** — see roadmap.
- **Hopper ARR backfill is still manual** via a CSV + `merge-hopper-arr.mjs`.

## Files worth reading first if you're Claude in a future session

1. This README.
2. `src/types.ts` — schema, `SCORING_KEYS`, `PlanningStatus`, `ContextKind`.
3. `src/lib/notionSync.ts` — Hopper API client (filter, pagination) + `mergeHopperRows`.
4. `vite.config.ts` — `/api/notion` proxy + token injection.
5. `src/App.tsx` — top-level state, filter model, sidebar wiring.
6. `src/components/TopBar.tsx` — KPI cards, sync card, filters, bulk actions.
7. `src/components/FeatureTable.tsx` — column layout, inline-edit, status row dimming.
8. `scripts/build-seed.mjs` — legacy normalizer (still used for Feature DB).
9. `scripts/merge-hopper-arr.mjs` — Hopper ARR CSV merger.

## Changelog

### May 2026 (later)

- **Sync To Hopper button** (`src/lib/notionSyncToHopper.ts`,
  `src/components/SyncToHopperCard.tsx`) — write-back of planning decisions to
  the Hopper. Pushes Committed / Icebox status to Hopper rows and creates
  Feature DB entries for newly committed items. Skips rows still in Reviewing
  and rows already promoted to the Feature DB; the success line surfaces the
  counts and the tooltip shows the full breakdown.
- **Icon refresh** — KPI scorecards and the sync cards now use PNG assets in
  `public/` (`loading.png`, `ice-bucket.png`, `check.png`, `loop.png`,
  `sync.png`) instead of emoji. `KpiScorecard` gained an `iconSrc` prop.
- **Sync card colors** — Sync From Hopper uses a soft indigo background; Sync
  To Hopper uses a soft green ("green light") background. Add Feature button
  shifted from primary blue to the same slate background as the other action
  cards.

### May 2026

- **Sync From Hopper button** + Vite dev-server proxy at `/api/notion`. Token kept server-side via `loadEnv` + `proxyReq` header injection; browser bundle never sees it. Pagination via cursors removes the 100-record cap that the MCP path hit.
- **Planning-status workflow** — `planningStatus` field (`null` / `'committed'` / `'icebox'`), Status filter, three KPI scorecards on the top bar, and dimmed-row styling for Iceboxed items.
- **Bulk Icebox Uncommitted** — one-click move of every Reviewing row to Icebox (with confirm).
- **Follow-up flag + inline note** — `needsFollowUp` checkbox and `followUpNote` text on every row, plus a Follow-up filter on the top bar.
- **Left context sidebar** — `ContextCard` for Company strategies and OSTs (`ContextItem` shape, persisted as `pm-roadmap-app:strategies:v1` and `pm-roadmap-app:osts:v1`).
- **Theme toggle** — dark/light, persisted as `pm-roadmap-app:theme:v1`. All components have `dark:` variants.
- **Layout width resizer** — drag handle on the page's right edge; double-click to reset; persisted as `pm-roadmap-app:layoutWidth:v1` (default 2100, min 1280).
- **`scripts/merge-hopper-arr.mjs`** — helper to merge a `notion_url,arr` CSV into `data/seed.json` for Hopper ARR backfill.

### April 2026 (initial scaffold)

- Scaffolded Vite + React + TS + Tailwind v3, RudderStack palette, Inter fallback for headings.
- Schema: name, AoR, 6 booleans, ARR, computed Score. Later added a 7th boolean (Competitor Parity).
- Top bar with AoR + Source filters, search, Load sample, Clear board, Import JSON, Export JSON, Export CSV, Add feature.
- Sort: Score → ARR tiebreak; Score and ARR column headers clickable for per-column asc/desc.
- UX: replaced `confirm()` popups with button tooltips for Load sample / Clear board; promoted Clear board into a proper secondary button.
- Feature column resize: 180–900px, default 420, persisted.
- MCP-driven Notion sync plumbing for Feature DB + Hopper, including ARR reconstruction via per-customer fetches (rollups omitted by MCP). Total Feature DB ARR reconstructed: ~$7.17M across 22 rows.
