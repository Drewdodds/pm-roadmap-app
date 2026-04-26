# PM Roadmap Scorer

Local-only prototype that helps Drew (PM for Application + Profiles at RudderStack)
score and sequence features pulled from Notion without the noise of the production
Notion databases. Scoring stays here; final calls are tagged back into Notion by hand.

## Vision / use case

Drew's day-to-day lives in two Notion databases:

- **The Hopper** ("Share your idea!") — catchall intake for any internal or
  external idea. Operationally critical but messy.
- **Feature Pipeline Database** — the features we've committed to build; tracks
  full lifecycle from Idea Gathering → Release → Post Validation.

When inheriting a set of AoRs (currently **Application** and **Profiles**), mid-process
orientation is hard: both DBs carry hundreds of records and dozens of columns
owned by multiple PMs, engineers, and stages. This app pulls only Drew-assigned
records, strips the noise, and gives a single surface for comparative scoring.

The workflow:

1. Sync Drew-assigned records from Notion into the app (manual, ad-hoc).
2. Score each feature on 7 strategic booleans + an ARR decimal.
3. Sort/filter to decide what to build and when.
4. Tag back to Notion manually (this app **does not write to Notion**).

## Schema (app-side)

This app **does not mirror** the Notion schemas. Those are the source of noise
we're escaping. In-app schema:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Feature title (from Notion title; editable) |
| `aor` | enum \| null | `Application` or `Profiles`; best-guess on import, user-editable |
| `scores.is_apart_of_company_strategy` | boolean | Aligned to a company-level strategic bet (UI: "Strategy") |
| `scores.attached_to_company_ost` | boolean | Linked to a company OST objective (UI: "OST") |
| `scores.minimize_churn` | boolean | Prevents/reduces churn (UI: "Churn Prevention") |
| `scores.operationally_critical` | boolean | Required to keep operations running (UI: "Ops Critical") |
| `scores.customer_ask` | boolean | Explicit customer request on file (UI: "Customer Ask") |
| `scores.increase_arr` | boolean | Opens/expands ARR (UI: "ARR Driver") |
| `scores.competitor_parity` | boolean | Parity feature needed to not lose deals (UI: "Competitor Parity") |
| `arr` | number | $ ARR attached to the feature (populated via Notion Customer rollup for Feature DB; via user-provided CSV for Hopper) |
| `source` | enum | `hopper` \| `feature` \| `manual` |
| `notionUrl` | string? | Link back to the Notion record |
| `id` | uuid | Stable app-side id |

**Computed:** `Score` = sum of the 7 booleans (0–7).

**Default sort:** Score descending, ARR descending tiebreak. Click any of the
**Score** or **ARR** column headers in the UI to switch sort key or toggle
asc/desc. The active column shows a filled arrow; clicking the same column
again flips direction.

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  Notion workspace                                                  │
│  ├── The Hopper DB         (Area PM = Drew — "Assigned to Me" view)│
│  ├── Feature Pipeline DB   (PM Owner = Drew — many views)          │
│  └── Current Customers DB  (ARR per customer, related to Feature)  │
└────────────────────┬──────────────────────────────────────────────┘
                     │ Claude queries via Notion MCP
                     ▼
┌───────────────────────────────────────────────────────────────────┐
│  Tool-result files (ephemeral, in Claude's tmp dir)                │
│  └── Raw JSON arrays of up to 100 records per call                 │
└────────────────────┬──────────────────────────────────────────────┘
                     │ scripts/build-seed.mjs + customer ARR merge
                     ▼
┌───────────────────────────────────────────────────────────────────┐
│  data/seed.json                                                    │
│  └── Normalized Feature[] per app schema                           │
└────────────────────┬──────────────────────────────────────────────┘
                     │ User clicks "Import JSON" in UI
                     ▼
┌───────────────────────────────────────────────────────────────────┐
│  Browser localStorage                                              │
│  ├── key `pm-roadmap-app:features:v1`     → feature set + scoring  │
│  └── key `pm-roadmap-app:nameColWidth:v1` → resizable name-col size│
│      Auto-saves on every change.                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Stack:** Vite + React + TypeScript + Tailwind v3. No backend. No auth.
Persistence is browser `localStorage` only, with JSON import/export as a
manual safety valve.

**Project layout:**

```
pm-roadmap-app/
├── src/
│   ├── App.tsx               # top-level state, filters, CRUD handlers
│   ├── types.ts              # schema + SCORING_KEYS + computeScore()
│   ├── storage.ts            # localStorage + JSON/CSV import/export
│   ├── sampleData.ts         # "Load sample" seed (5 synthetic rows)
│   └── components/
│       ├── TopBar.tsx        # AoR/source filters, search, action buttons
│       ├── FeatureTable.tsx  # main scoring grid (sort, resize, edit)
│       └── AddFeatureModal.tsx
├── scripts/
│   └── build-seed.mjs        # Notion tool-result → data/seed.json
├── data/
│   └── seed.json             # last sync output (do not commit if sensitive)
└── tailwind.config.js        # RudderStack palette + Inter fallback
```

**Styling:** RudderStack palette pulled from the visual style guide
(Primary-50 → Primary-900, accent colors). PolySans isn't freely licensed, so
headings fall back to Inter — tweak `tailwind.config.js` if PolySans gets
licensed for this context.

## UI behaviors worth knowing

- **Top bar**
  - **Load sample** — immediately replaces the current board with synthetic
    sample data. No confirm dialog; the button's tooltip warns ("Clear and
    board and load sample data").
  - **Clear board** — immediately drops all records from the front-end only.
    No backend or Notion writeback. Tooltip warns; no confirm dialog.
  - **Import JSON / Export JSON / Export CSV** — import replaces current
    state (with a confirm prompt); exports are non-destructive.
  - **AoR filter** — All / Application / Profiles.
  - **Source filter** — All / Hopper / Feature DB / Manual.
  - **Search** — substring match on feature name.
- **Feature table**
  - **Feature column** — default width 420px, drag the right edge of the
    header to resize (min 180, max 900). Width is persisted to localStorage.
  - **Sort** — click **Score** or **ARR** header to sort by that column.
    Clicking the active column toggles between descending (default) and
    ascending. Tiebreak is always the other numeric column, in the same
    direction.
  - **Inline edit** — name, AoR, ARR, and each boolean scoring checkbox are
    all editable directly in the row.
  - **Source chip** — color-coded: hopper=light purple, feature=blue,
    manual=gray.
  - **Score chip** — color-coded: 5+ green, 3–4 blue, 1–2 neutral, 0 muted.
  - **Open in Notion** — each synced row has a small link under the name
    that opens the original Notion page.

## Getting data in — the sync process

The Notion MCP runs inside Claude Code, **not** the browser. The app never
sees a Notion token. Sync is a conversational loop you run with Claude.

### Prerequisites (one-time)

- Notion connector is enabled in Claude Code.
- You are authenticated as Drew Dodds (so the `Area PM = me` view filter works).
- The Hopper "Assigned to Me" view has the following server-side filters
  applied (so the 100-record cap isn't wasted on Icebox/Duplicate rows):
  - `Area PM` contains `me`
  - `Hopper Stages` is not `Icebox` and is not `Duplicate`

### Every sync (conversational loop with Claude)

Tell Claude something like:

> Sync Hopper + Feature DB for Drew. Feature DB stages: Validation & Research,
> Product Refinement, Technical Refinement, Development.

Claude will:

1. Resolve Drew's Notion user ID via `notion-search` (query_type=user).
   Current value: `eac00464-c24f-4d39-ae97-5576db9bc9bb`.
2. Query **Hopper** via its "Assigned to Me" view (all records returned are
   Drew's; server-side filter already excludes Icebox/Duplicate).
   URL: `https://www.notion.so/rudderstacks/270f2b415dd080c2bcf9f43a84ccfd52?v=2b0f2b415dd08059a3ea000c505dcd22`
3. Query **Feature DB** via **multiple views** and union results by Notion URL.
   Individual views don't filter by PM Owner server-side, and each view hits
   the 100-record cap. Unioning 5 views (each sorted/grouped differently) is
   how we reach Drew's full set. Views used in the last sync:
   - Drew's View: `?v=305f2b415dd080cbb1aa000c1e0559a4`
   - All Features: `?v=290f2b415dd080b98c04000cc79ad637`
   - Prioritized Roadmap (or similar): `?v=2cbf2b415dd08082b3e1000c725653b9`
   - Two more: `?v=2a3f2b415dd08030af6a000c05dfba67`, `?v=30df2b415dd080cc8442000c8cdb3151`
4. Post-filter Feature DB rows client-side to keep only Drew's rows in the
   four active Pipeline Stages (`4. Validation & Research`,
   `6. Product Refinement`, `7. Technical Refinement`, `9. Development`).
5. Run `node scripts/build-seed.mjs --hopper <h.txt> --feature <f1.txt> --feature <f2.txt> ...`
   to normalize and write `data/seed.json`.
6. Print a summary: total records, by source, by AoR, plus the Feature DB item
   list for spot-checking.

Then for Feature DB ARR:

7. For each of the Drew Feature DB rows, pull its `Customer List` (relation
   URLs to the Current Customers DB).
8. Fetch each unique customer page (`notion-fetch`) — the customer page
   exposes `ARR` as a literal number. Rollups aren't exposed, so we reconstruct
   `Combined ARR` by summing customers per feature.
9. Patch `data/seed.json` with the summed ARR per feature row.

Then for Hopper ARR (interim: manual CSV):

10. You export the Hopper customer relations + Current Customers ARR from Notion,
    join by account name in Excel/Sheets, produce a CSV with columns
    `notion_url,arr`, save to `data/hopper_arr.csv`.
11. Ask Claude to merge: Claude reads the CSV, matches rows in `seed.json` by
    `notionUrl`, patches `arr` in place, reports rows matched vs skipped.

Finally, in the browser:

12. Open http://localhost:5173 → click **Clear board** → **Import JSON** →
    pick `data/seed.json`. You now have the full scored-and-ARR'd board.

### Important caveats

- **100-record cap.** `notion-query-database-view` returns at most 100 records
  per call. On the Hopper, the "Assigned to Me" view filters server-side to
  Drew so all 100 are his; still capped if Drew has >100. On the Feature DB,
  we union multiple views to reach all Drew-owned records.
- **No pagination.** The MCP tool doesn't expose a cursor. The workaround is
  multiple views with different sorts, unioned by Notion URL.
- **Rollups are omitted.** Both `notion-query-database-view` and
  `notion-fetch` return rollup values as `"<omitted />"`. That's why we can't
  read `Combined ARR` directly and instead reconstruct it from Customer List
  relations + per-customer ARR fetches.
- **AoR best-guess is just a guess.** Import logic maps `Product Area=Profiles`
  (Hopper) and `Initiative` / `Product Pillar` containing "Profiles" (Feature DB)
  → Profiles; everything else → Application. Verify the AoR column in the app
  and fix any misses before scoring.
- **Import replaces.** Importing JSON wipes the current in-app state. Use
  **Export JSON** first if you've scored and want a snapshot.
- **No writeback.** Scoring lives in the app. Tagging `Planned For`,
  `Target Quarter`, priority, etc. back onto Notion is manual (by design).

### Filter logic (as currently implemented)

| Source | Kept if | Dropped if |
|---|---|---|
| Hopper | `Area PM` contains Drew AND `Hopper Stages` NOT IN {`Icebox`, `Duplicate`} | Icebox, Duplicate |
| Feature DB | `PM Owner` contains Drew AND `Pipeline Stage` IN {`4. Validation & Research`, `6. Product Refinement`, `7. Technical Refinement`, `9. Development`} | all other stages |

These filters live in `scripts/build-seed.mjs` — edit `HOPPER_DROP_STAGES` and
`FEATURE_KEEP_STAGES` to change scope.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produces dist/
```

## Session log (April 2026)

What we built and changed during the initial session:

- **Scaffolded** Vite + React + TS + Tailwind v3, palette from the RudderStack
  Visual Style Guide (Primary-50 → Primary-900 + accent colors). Inter
  fallback for headings (PolySans not free).
- **Schema decided:** Feature Name (string), AoR (Application / Profiles),
  6 booleans, ARR decimal, computed Score. Later added a 7th boolean
  (Competitor Parity). Labels: Strategy / OST / Churn Prevention / Ops Critical /
  Customer Ask / ARR Driver / Competitor Parity.
- **Top bar** with AoR + Source filters, search, Load sample, Clear board,
  Import JSON, Export JSON, Export CSV, Add feature.
- **Sort:** originally had a Score×ARR composite sort toggle; dropped that in
  favor of a single Score → ARR tiebreak sort; later made Score and ARR column
  headers clickable for per-column sorting with asc/desc toggle.
- **UX polish:** replaced `confirm()` popups with button tooltips for Load
  sample and Clear board (direct action on click); promoted Clear board from
  a subtle text link into a proper secondary button.
- **Feature column resize:** default width 420px, pointer-drag handle on the
  right edge (min 180, max 900), width persisted to localStorage.
- **Notion sync plumbing**
  - Discovered both DB schemas, identified `Area PM` (Hopper) and `PM Owner`
    (Feature DB) as the PM field on each.
  - Hit the 100-record-per-view cap; resolved by:
    - Hopper: using "Assigned to Me" (filtered to Drew server-side) + asking
      you to add `Hopper Stages != Icebox, Duplicate` to that view so the cap
      isn't wasted on Icebox rows. Reached 100 kept.
    - Feature DB: unioning 5 different views' first 100 records each by Notion
      URL, then filtering client-side to Drew + 4 active stages. Reached all 22
      expected records (16 Validation / 3 Product Refinement / 1 Technical
      Refinement / 2 Development).
- **ARR population**
  - Feature DB: rollup (`Combined ARR`) is not exposed by the MCP. Reconstructed
    by pulling `Customer List` URLs per feature, fetching each unique customer
    page (24 uniques across all 22 features), summing per feature. Total
    Feature DB ARR reconstructed: ~$7.17M.
  - Hopper: too many customer-to-hopper joins to do via MCP practically. Plan
    is to let the PM export/join customer ARRs in Excel and hand Claude a
    `notion_url,arr` CSV; Claude merges into `seed.json`.

## Known limitations

- Single browser instance / single user — `localStorage` is not shared.
- No undo. Use Export JSON for checkpoints.
- CSV export is one-way (export only; no CSV import yet).
- Hopper ARR import still needs the PM-provided CSV merge step; scripted
  merger to follow.
- 100-record cap on Notion queries; no pagination available in MCP.
- Notion rollups are always omitted by MCP, so ARR rollup is reconstructed
  via per-customer fetches.
- No writeback to Notion (by design for this prototype).

## Files worth reading first if you're Claude in a future session

1. This README.
2. `src/types.ts` — authoritative schema.
3. `scripts/build-seed.mjs` — how Notion data is mapped into the app.
4. `src/App.tsx` — state shape, filter model.
5. `src/components/FeatureTable.tsx` — sort, resize, inline-edit behaviors.
