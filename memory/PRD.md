# PE Entity Structure Map - PRD

## Original Problem Statement
Build an app to map legal entities within a private equity firm using two CSV files: Entity Master (1756 entities) and Entity Relations (1917 relationships).

## Architecture
- **Backend**: FastAPI + MongoDB (motor) - CSV seeding on startup, REST API
- **Frontend**: React + React Flow + Dagre for tree layout, Tailwind CSS
- **Database**: MongoDB collections: `entities`, `relations`

## User Personas
- PE fund managers reviewing entity structures
- Legal/compliance teams auditing ownership chains
- Operations staff navigating corporate hierarchies

## Core Requirements
1. Interactive tree/hierarchy chart triggered by Fund ID selection
2. Search & filter entities (name, jurisdiction, type, fund, asset)
3. Ownership percentages displayed on relationship edges
4. CSV data imported as initial dataset

## What's Been Implemented (April 16, 2026)
- [x] CSV seeding into MongoDB on startup (1756 entities, 1917 relations)
- [x] Fund selector dropdown (52 valid funds)
- [x] Interactive hierarchy tree (React Flow + dagre auto-layout)
- [x] Custom nodes: company name, entity type badge, jurisdiction, top-of-structure styling
- [x] Custom edges: ownership % labels, EQUITY (blue solid) vs GENERAL_PARTNER (orange dashed)
- [x] Entity detail drawer (click node or sidebar item)
- [x] Search by company name
- [x] Filter by jurisdiction, entity type
- [x] Legend (Equity, GP, Top of Structure)
- [x] Neobrutalist schematic design (Chivo + IBM Plex Mono fonts, hard shadows)

## API Endpoints
- GET /api/funds - list valid funds
- GET /api/entities - search/filter entities
- GET /api/entities/filters - dropdown options
- GET /api/entities/{id} - entity detail
- GET /api/funds/{id}/tree - hierarchy tree data

## Testing
- 29/29 backend tests passed
- 100% frontend features verified

## Prioritized Backlog
- P1: Export tree as PNG/PDF
- P1: Bulk CSV re-upload to refresh data
- P2: Highlight full ownership chain on hover
- P2: Entity search within tree (zoom-to-node)
- P3: Multi-fund comparison view
