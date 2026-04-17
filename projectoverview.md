# Project Overview — PE Entity Structure Map

## What is this?

This application maps the legal entity structures within a private equity firm. It takes two source datasets — an **Entity Master** list and an **Entity Relations** map — and renders them as interactive, navigable hierarchy trees grouped by fund.

The tool supports portfolios of any scale — from a handful of entities to thousands — connected by parent-child relationships. Each relationship carries an ownership percentage and a type (Equity or General Partner). This tool lets users select any fund and instantly see its full corporate structure from the top-level LP down through every holding company, SPV, and operating entity.

## How it works

### Data pipeline

1. The user opens the app and is presented with an upload screen — no data is pre-loaded.
2. The user uploads two CSV files: **Entity Master** and **Entity Relations**.
3. Both files are parsed entirely in the browser using PapaParse. No data is sent to or stored on the backend.
4. The parsed data is held in React state for the duration of the session. Refreshing the page clears the data and returns to the upload screen.

### Backend (FastAPI)

The backend is a minimal health-check server. It serves no data endpoints — all logic runs client-side.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Returns `{status: ok}` |

### Frontend (React + React Flow + Dagre)

All data processing runs in the browser via `src/lib/dataService.js`:

- **CSV parsing**: PapaParse with type coercion (booleans, numbers, JSON symbologies)
- **Fund extraction**: Scans entities for unique `FUND_ID` values
- **Search & filter**: In-memory filtering by name, jurisdiction, type, fund
- **Tree building**: BFS traversal from `IS_TOP_OF_STRUCTURE` entities, producing React Flow nodes and edges

The UI is a "Control Room" layout:

- **Left sidebar** — Fund selector dropdown, entity search bar, jurisdiction/type filters, scrollable entity list.
- **Centre canvas** — Interactive tree rendered with React Flow. Nodes are positioned automatically using the Dagre graph layout algorithm, which computes optimal coordinates based on the tree's depth and breadth.
- **Right drawer** — Slides open on click to show full entity detail (jurisdiction, fund, asset, symbologies, editor, timestamps).

#### Node styling
- **Top-of-structure** entities render with a black background and blue shadow.
- **Standard** entities render with a white background and black shadow.
- **Collapsed** nodes show a blue border with a count of hidden descendants.

#### Edge styling
- **Equity** relationships: solid blue line with ownership percentage label.
- **General Partner** relationships: dashed orange line with "GP" indicator.

#### Large tree handling
For funds with 100+ entities, the app auto-collapses deeply nested or very wide branches on load, reducing visual complexity from hundreds of nodes to a manageable overview. Users can:
- **Double-click** any node to expand or collapse its children.
- Use **Expand All** / **Collapse** buttons for batch control.
- Use the **MiniMap** (bottom-right) for navigation context.
- Use **Fit View** to re-centre the tree.

#### PDF export
The **Export PDF** button captures the current tree view as a high-resolution landscape PDF (A3 for large trees, A4 for smaller ones) with a title header, entity/relation counts, export date, and a legend footer. It uses `html2canvas` for rasterisation and `jsPDF` for document generation.

## Objective

Provide the firm's fund managers, legal teams, and operations staff with a single tool to:

1. **Visualise** any fund's full corporate structure at a glance.
2. **Trace** ownership chains from the fund LP through to individual assets, with exact ownership percentages at every level.
3. **Search and filter** across the entire entity universe by name, jurisdiction, type, or asset.
4. **Inspect** any entity's full metadata (registration IDs, jurisdiction, fund/asset association, edit history).
5. **Export** structure diagrams as PDFs for board packs, compliance filings, and investor reporting.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI (health check only) |
| Frontend | React 19, React Flow, Dagre, Tailwind CSS, Shadcn/UI, PapaParse |
| PDF export | html-to-image, jsPDF |
| Fonts | Chivo (headings), IBM Plex Mono (data/mono) |
