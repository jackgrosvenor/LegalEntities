import Papa from 'papaparse';

/**
 * Parse a raw CSV row: trim strings, convert booleans/numbers, parse JSON fields.
 */
function cleanRow(row) {
  const cleaned = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null || (typeof value === 'string' && value.trim() === '')) {
      cleaned[key] = null;
    } else if (typeof value === 'string') {
      const v = value.trim();
      if (v.toLowerCase() === 'true') cleaned[key] = true;
      else if (v.toLowerCase() === 'false') cleaned[key] = false;
      else if (/^-?\d+$/.test(v)) cleaned[key] = parseInt(v, 10);
      else if (/^-?\d+\.\d+$/.test(v)) cleaned[key] = parseFloat(v);
      else cleaned[key] = v;
    } else {
      cleaned[key] = value;
    }
  }
  // Parse SYMBOLOGIES as JSON
  if (cleaned.SYMBOLOGIES && typeof cleaned.SYMBOLOGIES === 'string') {
    try { cleaned.SYMBOLOGIES = JSON.parse(cleaned.SYMBOLOGIES); }
    catch { cleaned.SYMBOLOGIES = null; }
  }
  return cleaned;
}

/**
 * Parse CSV text into cleaned row objects.
 */
function parseCsv(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return result.data.map(cleanRow);
}

/**
 * Parse an uploaded File object and return cleaned rows.
 */
export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = parseCsv(text);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Validate that entities have required columns.
 */
export function validateEntities(entities) {
  if (!entities || entities.length === 0) return 'Entity Master CSV is empty';
  const cols = Object.keys(entities[0]);
  if (!cols.includes('ENTITY_ID')) return 'Entity Master CSV missing ENTITY_ID column';
  if (!cols.includes('COMPANY_NAME')) return 'Entity Master CSV missing COMPANY_NAME column';
  return null;
}

/**
 * Validate that relations have required columns.
 */
export function validateRelations(relations) {
  if (!relations || relations.length === 0) return 'Entity Relations CSV is empty';
  const cols = Object.keys(relations[0]);
  if (!cols.includes('PARENT_ID')) return 'Entity Relations CSV missing PARENT_ID column';
  if (!cols.includes('CHILD_ID')) return 'Entity Relations CSV missing CHILD_ID column';
  return null;
}

/**
 * Extract unique funds with names from entities.
 */
export function getFunds(entities) {
  const fundMap = new Map();
  for (const e of entities) {
    if (e.FUND_ID != null && e.DELETED !== true) {
      if (!fundMap.has(e.FUND_ID)) {
        fundMap.set(e.FUND_ID, e.FUND_NAME || `Fund ${e.FUND_ID}`);
      }
    }
  }
  return Array.from(fundMap.entries())
    .map(([fund_id, fund_name]) => ({ fund_id, fund_name }))
    .sort((a, b) => a.fund_id - b.fund_id);
}

/**
 * Get unique filter values.
 */
export function getFilters(entities) {
  const jurisdictions = new Set();
  const entityTypes = new Set();
  for (const e of entities) {
    if (e.DELETED === true) continue;
    if (e.JURISDICTION) jurisdictions.add(e.JURISDICTION);
    if (e.ENTITY_TYPE) entityTypes.add(e.ENTITY_TYPE);
  }
  return {
    jurisdictions: Array.from(jurisdictions).sort(),
    entity_types: Array.from(entityTypes).sort(),
  };
}

/**
 * Search and filter entities.
 */
export function searchEntities(entities, { search, jurisdiction, entityType, fundId, limit = 50 }) {
  let filtered = entities.filter(e => e.DELETED !== true);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(e => e.COMPANY_NAME && e.COMPANY_NAME.toLowerCase().includes(q));
  }
  if (jurisdiction) filtered = filtered.filter(e => e.JURISDICTION === jurisdiction);
  if (entityType) filtered = filtered.filter(e => e.ENTITY_TYPE === entityType);
  if (fundId != null) filtered = filtered.filter(e => e.FUND_ID === fundId);

  filtered.sort((a, b) => (a.COMPANY_NAME || '').localeCompare(b.COMPANY_NAME || ''));
  const total = filtered.length;
  return { entities: filtered.slice(0, limit), total };
}

/**
 * Get a single entity by ID.
 */
export function getEntity(entities, entityId) {
  return entities.find(e => e.ENTITY_ID === entityId) || null;
}

/**
 * Build the hierarchy tree for a fund using BFS from top-of-structure entities.
 * Returns { nodes, edges, fund_name } ready for React Flow.
 */
export function buildFundTree(fundId, entities, relations) {
  const activeRelations = relations.filter(r => r.DELETED !== true);

  // Find root entities for this fund
  let roots = entities.filter(
    e => e.FUND_ID === fundId && e.IS_TOP_OF_STRUCTURE === true && e.DELETED !== true
  );

  if (roots.length === 0) {
    // Fallback: find entities for this fund and pick those that aren't children
    const fundEntities = entities.filter(e => e.FUND_ID === fundId && e.DELETED !== true);
    if (fundEntities.length === 0) return { nodes: [], edges: [], fund_name: '' };

    const entityIds = new Set(fundEntities.map(e => e.ENTITY_ID));
    const childIds = new Set();
    for (const r of activeRelations) {
      if (entityIds.has(r.PARENT_ID)) childIds.add(r.CHILD_ID);
    }
    roots = fundEntities.filter(e => !childIds.has(e.ENTITY_ID));
    if (roots.length === 0) roots = fundEntities.slice(0, 1);
  }

  // Build entity lookup
  const entityMap = new Map();
  for (const e of entities) entityMap.set(e.ENTITY_ID, e);

  // Build parent→children index
  const parentIndex = new Map();
  for (const r of activeRelations) {
    if (!parentIndex.has(r.PARENT_ID)) parentIndex.set(r.PARENT_ID, []);
    parentIndex.get(r.PARENT_ID).push(r);
  }

  // BFS from roots
  const visited = new Set();
  const queue = roots.map(r => r.ENTITY_ID);
  const allEntityIds = new Set();
  const allRelations = [];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    allEntityIds.add(currentId);

    const childRels = parentIndex.get(currentId) || [];
    for (const rel of childRels) {
      allRelations.push(rel);
      if (!visited.has(rel.CHILD_ID)) queue.push(rel.CHILD_ID);
    }
  }

  // Build React Flow nodes
  const nodes = [];
  for (const eid of allEntityIds) {
    const entity = entityMap.get(eid);
    if (!entity) continue;
    nodes.push({
      id: String(eid),
      data: {
        label: entity.COMPANY_NAME || `Entity ${eid}`,
        entity_type: entity.ENTITY_TYPE || '',
        jurisdiction: entity.JURISDICTION || '',
        is_top: entity.IS_TOP_OF_STRUCTURE === true,
        fund_name: entity.FUND_NAME || '',
        asset_name: entity.ASSET_NAME || '',
        entity_id: eid,
      },
      type: 'entityNode',
    });
  }

  // Build React Flow edges (deduplicated)
  const edges = [];
  const seenEdges = new Set();
  for (const rel of allRelations) {
    const key = `${rel.PARENT_ID}-${rel.CHILD_ID}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);

    const ownership = typeof rel.EQUITIX_OWNERSHIP_DECIMAL === 'number'
      ? rel.EQUITIX_OWNERSHIP_DECIMAL : 0;
    const ownershipPct = `${(ownership * 100).toFixed(1)}%`;

    edges.push({
      id: `e-${rel.PARENT_ID}-${rel.CHILD_ID}`,
      source: String(rel.PARENT_ID),
      target: String(rel.CHILD_ID),
      type: 'ownershipEdge',
      data: {
        ownership: ownershipPct,
        relation_type: rel.RELATION_TYPE || 'EQUITY',
        ownership_decimal: ownership,
      },
    });
  }

  const fund_name = roots[0]?.FUND_NAME || '';
  return { nodes, edges, fund_name };
}


const STORAGE_KEY = 'pe-entity-map-dataset';

/**
 * Save dataset to localStorage.
 */
export function saveToStorage(dataset) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      entities: dataset.entities,
      relations: dataset.relations,
    }));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/**
 * Load dataset from localStorage and recompute derived data (funds, filters).
 * Returns null if nothing stored or data is invalid.
 */
export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { entities, relations } = JSON.parse(raw);
    if (!entities?.length || !relations?.length) return null;
    return {
      entities,
      relations,
      funds: getFunds(entities),
      filters: getFilters(entities),
    };
  } catch {
    return null;
  }
}

/**
 * Clear persisted dataset.
 */
export function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
