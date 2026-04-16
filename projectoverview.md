# Project Overview — PE Entity Structure Map

## What is this?

This application maps the legal entity structures within a private equity firm. It takes two source datasets — an **Entity Master** list and an **Entity Relations** map — and renders them as interactive, navigable hierarchy trees grouped by fund.

The firm manages 52 funds across a portfolio of 1,756 legal entities connected by 1,917 parent-child relationships. Each relationship carries an ownership percentage and a type (Equity or General Partner). This tool lets users select any fund and instantly see its full corporate structure from the top-level LP down through every holding company, SPV, and operating entity.

## How it works

### Data pipeline

1. Two CSV files (`entity_master.csv` and `entity_relations.csv`) are loaded into MongoDB on first startup.
2. The **Entity Master** contains one row per entity with fields including company name, jurisdiction, entity type, fund association, asset association, and registration symbologies.
3. The **Entity Relations** file maps parent → child connections between entities, each annotated with an ownership decimal (0–1) and a relation type (`EQUITY` or `GENERAL_PARTNER`).

### Backend (FastAPI + MongoDB)

The backend exposes a REST API:

| Endpoint | Purpose |
|---|---|
| `GET /api/funds` | Returns the 52 valid funds with their IDs and names |
| `GET /api/entities` | Paginated entity search with filters (name, jurisdiction, type, fund, asset) |
| `GET /api/entities/filters` | Distinct values for filter dropdowns |
| `GET /api/entities/{id}` | Full detail for a single entity |
| `GET /api/funds/{fund_id}/tree` | Builds the hierarchy tree for a fund using BFS from its top-of-structure entity, returning nodes and edges ready for the frontend |

The tree-building algorithm starts from entities marked `IS_TOP_OF_STRUCTURE = true` for the selected fund, then performs a breadth-first traversal following parent → child relations to capture the entire downstream structure — including entities that may not have the fund ID directly assigned.

### Frontend (React + React Flow + Dagre)

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
| Backend | Python, FastAPI, Motor (async MongoDB driver) |
| Database | MongoDB |
| Frontend | React 19, React Flow, Dagre, Tailwind CSS, Shadcn/UI |
| PDF export | html2canvas, jsPDF |
| Fonts | Chivo (headings), IBM Plex Mono (data/mono) |
