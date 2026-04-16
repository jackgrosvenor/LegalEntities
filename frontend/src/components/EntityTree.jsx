import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import EntityNode from './EntityNode';
import OwnershipEdge from './OwnershipEdge';
import EntityDrawer from './EntityDrawer';
import { TreeStructure, Spinner, ArrowsOutSimple, ArrowsInSimple, ArrowsOut } from '@phosphor-icons/react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const nodeTypes = { entityNode: EntityNode };
const edgeTypes = { ownershipEdge: OwnershipEdge };

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

function getLayoutedElements(visibleNodes, visibleEdges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  // Compute max fan-out
  const childCounts = {};
  visibleEdges.forEach(e => {
    childCounts[e.source] = (childCounts[e.source] || 0) + 1;
  });
  const maxFanOut = Object.values(childCounts).length > 0
    ? Math.max(...Object.values(childCounts))
    : 1;
  const nodeCount = visibleNodes.length;

  // Dynamic spacing — scale with tree complexity
  let nodesep = 80;
  let ranksep = 140;

  if (maxFanOut > 8) nodesep = Math.max(nodesep, 40 + maxFanOut * 12);
  if (nodeCount > 50) { nodesep = Math.max(nodesep, 110); ranksep = Math.max(ranksep, 160); }
  if (nodeCount > 150) { nodesep = Math.max(nodesep, 140); ranksep = Math.max(ranksep, 180); }

  g.setGraph({ rankdir: 'TB', nodesep, ranksep, marginx: 60, marginy: 60 });

  visibleNodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  visibleEdges.forEach(e => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const layoutedNodes = visibleNodes.map(node => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });

  return { nodes: layoutedNodes, edges: visibleEdges };
}

// Build parent→children and child→parent maps
function buildTreeMaps(edges) {
  const parentToChildren = {};
  const childToParent = {};
  edges.forEach(e => {
    if (!parentToChildren[e.source]) parentToChildren[e.source] = [];
    parentToChildren[e.source].push(e.target);
    childToParent[e.target] = e.source;
  });
  return { parentToChildren, childToParent };
}

// Collect all descendant IDs from a node
function getDescendants(nodeId, parentToChildren) {
  const desc = new Set();
  const queue = [nodeId];
  while (queue.length) {
    const id = queue.shift();
    const children = parentToChildren[id] || [];
    for (const c of children) {
      if (!desc.has(c)) {
        desc.add(c);
        queue.push(c);
      }
    }
  }
  return desc;
}

function EntityTreeInner({ fundId }) {
  const { fitView } = useReactFlow();
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [fundName, setFundName] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const treeMapsRef = useRef({ parentToChildren: {}, childToParent: {} });

  // Fetch tree data
  useEffect(() => {
    if (!fundId) {
      setAllNodes([]); setAllEdges([]); setNodes([]); setEdges([]);
      setFundName(''); setCollapsed(new Set());
      return;
    }
    setLoading(true);
    setSelectedEntityId(null);
    setCollapsed(new Set());
    axios.get(`${API}/funds/${fundId}/tree`)
      .then(res => {
        const { nodes: rawNodes, edges: rawEdges, fund_name } = res.data;
        setFundName(fund_name || '');
        const styledEdges = rawEdges.map(e => ({
          ...e,
          markerEnd: { type: MarkerType.ArrowClosed, color: e.data?.relation_type === 'GENERAL_PARTNER' ? '#EA580C' : '#2563EB' },
        }));
        const maps = buildTreeMaps(styledEdges);
        treeMapsRef.current = maps;
        setAllNodes(rawNodes);
        setAllEdges(styledEdges);

        // Auto-collapse for large trees: collapse deep/wide branches
        if (rawNodes.length > 100) {
          const autoCollapse = new Set();
          const { parentToChildren } = maps;
          const childSet = new Set(styledEdges.map(e => e.target));
          const roots = rawNodes.filter(n => !childSet.has(n.id)).map(n => n.id);

          // BFS to compute depth
          const depth = {};
          const queue = roots.map(r => ({ id: r, d: 0 }));
          while (queue.length) {
            const { id, d } = queue.shift();
            if (depth[id] !== undefined) continue;
            depth[id] = d;
            const ch = parentToChildren[id] || [];
            // Collapse nodes at depth >= 3 with 6+ children
            if (d >= 3 && ch.length >= 6) {
              autoCollapse.add(id);
            }
            ch.forEach(c => queue.push({ id: c, d: d + 1 }));
          }
          // Always collapse very wide nodes (15+ children) at any depth > 0
          Object.entries(parentToChildren).forEach(([id, ch]) => {
            if (ch.length >= 15 && (depth[id] || 0) > 0) autoCollapse.add(id);
          });
          setCollapsed(autoCollapse);
        } else {
          setCollapsed(new Set());
        }
      })
      .catch(() => { setAllNodes([]); setAllEdges([]); })
      .finally(() => setLoading(false));
  }, [fundId, setNodes, setEdges]);

  // Recompute visible nodes/edges when collapsed set changes
  useEffect(() => {
    if (allNodes.length === 0) { setNodes([]); setEdges([]); return; }

    const { parentToChildren } = treeMapsRef.current;

    // Find all hidden node IDs (descendants of collapsed nodes)
    const hidden = new Set();
    collapsed.forEach(collapsedId => {
      getDescendants(collapsedId, parentToChildren).forEach(d => hidden.add(d));
    });

    // Mark nodes that have children with collapse info
    const visibleNodes = allNodes
      .filter(n => !hidden.has(n.id))
      .map(n => {
        const children = parentToChildren[n.id] || [];
        const hasChildren = children.length > 0;
        const isCollapsed = collapsed.has(n.id);
        const hiddenCount = isCollapsed ? getDescendants(n.id, parentToChildren).size : 0;
        return {
          ...n,
          data: { ...n.data, hasChildren, isCollapsed, hiddenCount }
        };
      });

    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = allEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));

    const { nodes: ln, edges: le } = getLayoutedElements(visibleNodes, visibleEdges);
    setNodes(ln);
    setEdges(le);

    // Fit view after layout
    setTimeout(() => fitView({ padding: 0.15, maxZoom: 0.8, duration: 300 }), 100);
  }, [allNodes, allEdges, collapsed, setNodes, setEdges, fitView]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedEntityId(node.data.entity_id);
  }, []);

  // Double-click to toggle collapse
  const onNodeDoubleClick = useCallback((_, node) => {
    const { parentToChildren } = treeMapsRef.current;
    const children = parentToChildren[node.id] || [];
    if (children.length === 0) return;

    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }, []);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, maxZoom: 1, duration: 400 });
  }, [fitView]);

  const defaultEdgeOptions = useMemo(() => ({ type: 'ownershipEdge' }), []);

  const minimapNodeColor = useCallback((node) => {
    if (node.data?.is_top) return '#09090B';
    if (node.data?.isCollapsed) return '#2563EB';
    return '#E4E4E7';
  }, []);

  return (
    <div className="flex-1 relative h-full" data-testid="entity-tree-canvas">
      {/* Canvas header */}
      {fundName && (
        <div className="absolute top-4 left-4 z-10 bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-4 py-2" data-testid="fund-header">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 block">
            Structure View
          </span>
          <span className="text-base font-bold font-heading tracking-tight text-neutral-900">
            {fundName}
          </span>
          <span className="text-[10px] font-mono text-neutral-400 ml-2">
            {nodes.length} / {allNodes.length} entities &middot; {edges.length} relations
          </span>
          {collapsed.size > 0 && (
            <span className="text-[10px] font-mono text-blue-600 ml-2">
              ({collapsed.size} collapsed)
            </span>
          )}
        </div>
      )}

      {/* Legend + controls */}
      {fundId && nodes.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2" data-testid="tree-legend-area">
          <div className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-4" data-testid="tree-legend">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 bg-blue-600" />
              <span className="text-[10px] font-mono text-neutral-600">Equity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 border-t-2 border-dashed border-orange-600" />
              <span className="text-[10px] font-mono text-neutral-600">General Partner</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-neutral-900 border border-neutral-900" />
              <span className="text-[10px] font-mono text-neutral-600">Top</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-100 border-2 border-blue-600" />
              <span className="text-[10px] font-mono text-neutral-600">Collapsed</span>
            </div>
          </div>
          <div className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-1.5 text-[10px] font-mono text-neutral-500">
            Double-click a node to collapse/expand its children
          </div>
        </div>
      )}

      {/* Action buttons */}
      {fundId && nodes.length > 0 && (
        <div className="absolute top-4 right-4 z-10 flex gap-2" data-testid="tree-actions">
          <button
            data-testid="expand-all-btn"
            onClick={() => setCollapsed(new Set())}
            className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-2 hover:bg-neutral-50 transition-colors"
            title="Expand all collapsed nodes"
          >
            <ArrowsOut size={14} weight="bold" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Expand All</span>
          </button>
          <button
            data-testid="collapse-all-btn"
            onClick={() => {
              const { parentToChildren } = treeMapsRef.current;
              const toCollapse = new Set();
              Object.entries(parentToChildren).forEach(([id, ch]) => {
                if (ch.length > 0) toCollapse.add(id);
              });
              // Keep roots expanded
              const childSet = new Set(allEdges.map(e => e.target));
              allNodes.filter(n => !childSet.has(n.id)).forEach(n => toCollapse.delete(n.id));
              setCollapsed(toCollapse);
            }}
            className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-2 hover:bg-neutral-50 transition-colors"
            title="Collapse all branches"
          >
            <ArrowsInSimple size={14} weight="bold" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Collapse</span>
          </button>
          <button
            data-testid="fit-view-btn"
            onClick={handleFitView}
            className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-2 hover:bg-neutral-50 transition-colors"
            title="Fit tree to viewport"
          >
            <ArrowsOutSimple size={14} weight="bold" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Fit View</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-full canvas-grid">
          <div className="flex flex-col items-center gap-3">
            <Spinner size={32} weight="bold" className="text-neutral-400 animate-spin" />
            <span className="text-sm font-mono text-neutral-500">Building structure...</span>
          </div>
        </div>
      ) : !fundId ? (
        <div className="flex items-center justify-center h-full canvas-grid">
          <div className="flex flex-col items-center gap-4 max-w-xs text-center">
            <div className="w-16 h-16 border-2 border-neutral-300 flex items-center justify-center">
              <TreeStructure size={32} weight="thin" className="text-neutral-300" />
            </div>
            <div>
              <p className="text-sm font-bold font-heading text-neutral-600">No Fund Selected</p>
              <p className="text-xs font-mono text-neutral-400 mt-1">
                Select a fund from the sidebar to visualize its entity structure
              </p>
            </div>
          </div>
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full canvas-grid">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-bold font-heading text-neutral-600">No Entities Found</p>
            <p className="text-xs font-mono text-neutral-400">
              This fund has no entity structure to display
            </p>
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 0.8 }}
          minZoom={0.02}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls
            className="!rounded-none !border-2 !border-neutral-900 !shadow-[4px_4px_0px_0px_rgba(9,9,11,1)]"
            showInteractive={false}
          />
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={2}
            nodeBorderRadius={0}
            maskColor="rgba(0,0,0,0.08)"
            className="!rounded-none !border-2 !border-neutral-900 !shadow-[4px_4px_0px_0px_rgba(9,9,11,1)]"
          />
          <Background color="#D4D4D8" gap={24} size={1} />
        </ReactFlow>
      )}

      {/* Entity Detail Drawer */}
      {selectedEntityId && (
        <EntityDrawer
          entityId={selectedEntityId}
          onClose={() => setSelectedEntityId(null)}
        />
      )}
    </div>
  );
}

export default function EntityTree({ fundId }) {
  return (
    <ReactFlowProvider>
      <EntityTreeInner fundId={fundId} />
    </ReactFlowProvider>
  );
}
