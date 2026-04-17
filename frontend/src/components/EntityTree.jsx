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
  getNodesBounds,
  getViewportForBounds,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import EntityNode from './EntityNode';
import OwnershipEdge from './OwnershipEdge';
import EntityDrawer from './EntityDrawer';
import { TreeStructure, Spinner, ArrowsOutSimple, ArrowsInSimple, ArrowsOut, FilePdf } from '@phosphor-icons/react';
import { buildFundTree } from '@/lib/dataService';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const nodeTypes = { entityNode: EntityNode };
const edgeTypes = { ownershipEdge: OwnershipEdge };

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

function getLayoutedElements(visibleNodes, visibleEdges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  const childCounts = {};
  visibleEdges.forEach(e => { childCounts[e.source] = (childCounts[e.source] || 0) + 1; });
  const maxFanOut = Object.values(childCounts).length > 0 ? Math.max(...Object.values(childCounts)) : 1;
  const nodeCount = visibleNodes.length;

  let nodesep = 80, ranksep = 140;
  if (maxFanOut > 8) nodesep = Math.max(nodesep, 40 + maxFanOut * 12);
  if (nodeCount > 50) { nodesep = Math.max(nodesep, 110); ranksep = Math.max(ranksep, 160); }
  if (nodeCount > 150) { nodesep = Math.max(nodesep, 140); ranksep = Math.max(ranksep, 180); }

  g.setGraph({ rankdir: 'TB', nodesep, ranksep, marginx: 60, marginy: 60 });
  visibleNodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  visibleEdges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return {
    nodes: visibleNodes.map(node => {
      const pos = g.node(node.id);
      return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
    }),
    edges: visibleEdges,
  };
}

function buildTreeMaps(edges) {
  const parentToChildren = {};
  edges.forEach(e => {
    if (!parentToChildren[e.source]) parentToChildren[e.source] = [];
    parentToChildren[e.source].push(e.target);
  });
  return { parentToChildren };
}

function getDescendants(nodeId, parentToChildren) {
  const desc = new Set();
  const queue = [nodeId];
  while (queue.length) {
    const id = queue.shift();
    for (const c of (parentToChildren[id] || [])) {
      if (!desc.has(c)) { desc.add(c); queue.push(c); }
    }
  }
  return desc;
}

function EntityTreeInner({ fundId, dataset }) {
  const { fitView, getNodes } = useReactFlow();
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [fundName, setFundName] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const treeMapsRef = useRef({ parentToChildren: {} });

  // Build tree from dataset when fundId changes
  useEffect(() => {
    if (!fundId || !dataset) {
      setAllNodes([]); setAllEdges([]); setNodes([]); setEdges([]);
      setFundName(''); setCollapsed(new Set());
      return;
    }

    setSelectedEntityId(null);

    const { nodes: rawNodes, edges: rawEdges, fund_name } = buildFundTree(fundId, dataset.entities, dataset.relations);
    setFundName(fund_name || '');

    const styledEdges = rawEdges.map(e => ({
      ...e,
      markerEnd: { type: MarkerType.ArrowClosed, color: e.data?.relation_type === 'GENERAL_PARTNER' ? '#EA580C' : '#2563EB' },
    }));

    const maps = buildTreeMaps(styledEdges);
    treeMapsRef.current = maps;
    setAllNodes(rawNodes);
    setAllEdges(styledEdges);

    // Auto-collapse for large trees
    if (rawNodes.length > 100) {
      const autoCollapse = new Set();
      const { parentToChildren } = maps;
      const childSet = new Set(styledEdges.map(e => e.target));
      const roots = rawNodes.filter(n => !childSet.has(n.id)).map(n => n.id);
      const depth = {};
      const queue = roots.map(r => ({ id: r, d: 0 }));
      while (queue.length) {
        const { id, d } = queue.shift();
        if (depth[id] !== undefined) continue;
        depth[id] = d;
        const ch = parentToChildren[id] || [];
        if (d >= 3 && ch.length >= 6) autoCollapse.add(id);
        ch.forEach(c => queue.push({ id: c, d: d + 1 }));
      }
      Object.entries(parentToChildren).forEach(([id, ch]) => {
        if (ch.length >= 15 && (depth[id] || 0) > 0) autoCollapse.add(id);
      });
      setCollapsed(autoCollapse);
    } else {
      setCollapsed(new Set());
    }
  }, [fundId, dataset, setNodes, setEdges]);

  // Recompute visible nodes/edges when collapsed set changes
  useEffect(() => {
    if (allNodes.length === 0) { setNodes([]); setEdges([]); return; }
    const { parentToChildren } = treeMapsRef.current;

    const hidden = new Set();
    collapsed.forEach(cid => getDescendants(cid, parentToChildren).forEach(d => hidden.add(d)));

    const visibleNodes = allNodes.filter(n => !hidden.has(n.id)).map(n => {
      const children = parentToChildren[n.id] || [];
      const isCollapsed = collapsed.has(n.id);
      return { ...n, data: { ...n.data, hasChildren: children.length > 0, isCollapsed, hiddenCount: isCollapsed ? getDescendants(n.id, parentToChildren).size : 0 } };
    });

    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = allEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));

    const { nodes: ln, edges: le } = getLayoutedElements(visibleNodes, visibleEdges);
    setNodes(ln);
    setEdges(le);
    setTimeout(() => fitView({ padding: 0.15, maxZoom: 0.8, duration: 300 }), 100);
  }, [allNodes, allEdges, collapsed, setNodes, setEdges, fitView]);

  const onNodeClick = useCallback((_, node) => setSelectedEntityId(node.data.entity_id), []);

  const onNodeDoubleClick = useCallback((_, node) => {
    const { parentToChildren } = treeMapsRef.current;
    if (!(parentToChildren[node.id] || []).length) return;
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(node.id) ? next.delete(node.id) : next.add(node.id);
      return next;
    });
  }, []);

  const handleFitView = useCallback(() => fitView({ padding: 0.15, maxZoom: 1, duration: 400 }), [fitView]);

  const handleExportPdf = useCallback(async () => {
    const viewportEl = document.querySelector('.react-flow__viewport');
    if (!viewportEl) return;
    setExporting(true);
    try {
      const currentNodes = getNodes();
      if (currentNodes.length === 0) { setExporting(false); return; }

      const bounds = getNodesBounds(currentNodes);
      const padding = 60;
      const paddedBounds = { x: bounds.x - padding, y: bounds.y - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2 };

      const scale = 2;
      const maxDim = 8000;
      const sf = Math.min(maxDim / (paddedBounds.width * scale), maxDim / (paddedBounds.height * scale), 1);
      const imageWidth = Math.round(paddedBounds.width * scale * sf);
      const imageHeight = Math.round(paddedBounds.height * scale * sf);

      const vp = getViewportForBounds(paddedBounds, imageWidth, imageHeight, 0.1, 2);

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#F4F4F5', width: imageWidth, height: imageHeight, skipFonts: true,
        style: { width: `${imageWidth}px`, height: `${imageHeight}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
        filter: (node) => !(node?.classList?.contains('react-flow__minimap') || node?.classList?.contains('react-flow__controls')),
      });

      const aspectRatio = imageWidth / imageHeight;
      const orientation = aspectRatio >= 0.9 ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'mm', format: nodes.length > 40 ? 'a3' : 'a4' });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();

      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
      pdf.text(`${fundName || 'Fund'} — Entity Structure`, 10, 12);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(100);
      pdf.text(`${nodes.length}${allNodes.length !== nodes.length ? ` / ${allNodes.length}` : ''} entities · ${edges.length} relations · Exported ${new Date().toLocaleDateString()}`, 10, 18);
      pdf.setTextColor(0);

      const m = 8, ho = 22, fs = 8;
      const aw = pw - m * 2, ah = ph - ho - fs;
      const r = Math.min(aw / imageWidth, ah / imageHeight);
      pdf.addImage(dataUrl, 'PNG', m + (aw - imageWidth * r) / 2, ho + (ah - imageHeight * r) / 2, imageWidth * r, imageHeight * r);

      pdf.setFontSize(7); pdf.setTextColor(120);
      pdf.text('Legend: Blue solid = Equity | Orange dashed = General Partner | Black node = Top of Structure', m, ph - 4);
      pdf.save(`${(fundName || 'fund').replace(/\s+/g, '_')}_structure.pdf`);
    } catch (err) { console.error('PDF export failed:', err); }
    finally { setExporting(false); }
  }, [fundName, nodes, allNodes, edges, getNodes]);

  const defaultEdgeOptions = useMemo(() => ({ type: 'ownershipEdge' }), []);
  const minimapNodeColor = useCallback((node) => {
    if (node.data?.is_top) return '#09090B';
    if (node.data?.isCollapsed) return '#2563EB';
    return '#E4E4E7';
  }, []);

  return (
    <div className="flex-1 relative h-full" data-testid="entity-tree-canvas">
      {fundName && (
        <div className="absolute top-4 left-4 z-10 bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-4 py-2" data-testid="fund-header">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 block">Structure View</span>
          <span className="text-base font-bold font-heading tracking-tight text-neutral-900">{fundName}</span>
          <span className="text-[10px] font-mono text-neutral-400 ml-2">{nodes.length} / {allNodes.length} entities &middot; {edges.length} relations</span>
          {collapsed.size > 0 && <span className="text-[10px] font-mono text-blue-600 ml-2">({collapsed.size} collapsed)</span>}
        </div>
      )}

      {fundId && nodes.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2" data-testid="tree-legend-area">
          <div className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-4" data-testid="tree-legend">
            <div className="flex items-center gap-1.5"><div className="w-5 h-0.5 bg-blue-600" /><span className="text-[10px] font-mono text-neutral-600">Equity</span></div>
            <div className="flex items-center gap-1.5"><div className="w-5 h-0.5 border-t-2 border-dashed border-orange-600" /><span className="text-[10px] font-mono text-neutral-600">General Partner</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-neutral-900 border border-neutral-900" /><span className="text-[10px] font-mono text-neutral-600">Top</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-100 border-2 border-blue-600" /><span className="text-[10px] font-mono text-neutral-600">Collapsed</span></div>
          </div>
          <div className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-1.5 text-[10px] font-mono text-neutral-500">Double-click a node to collapse/expand its children</div>
        </div>
      )}

      {fundId && nodes.length > 0 && (
        <div className="absolute top-4 right-4 z-10 flex gap-2" data-testid="tree-actions">
          <button data-testid="export-pdf-btn" onClick={handleExportPdf} disabled={exporting}
            className="bg-neutral-900 text-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] px-3 py-2 flex items-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-wait"
            title="Export current view as PDF">
            {exporting ? <Spinner size={14} weight="bold" className="animate-spin" /> : <FilePdf size={14} weight="bold" />}
            <span className="text-[10px] font-mono uppercase tracking-wider">{exporting ? 'Exporting...' : 'Export PDF'}</span>
          </button>
          <button data-testid="expand-all-btn" onClick={() => setCollapsed(new Set())}
            className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-2 hover:bg-neutral-50 transition-colors" title="Expand all collapsed nodes">
            <ArrowsOut size={14} weight="bold" /><span className="text-[10px] font-mono uppercase tracking-wider">Expand All</span>
          </button>
          <button data-testid="collapse-all-btn" onClick={() => {
            const { parentToChildren } = treeMapsRef.current;
            const toCollapse = new Set();
            Object.entries(parentToChildren).forEach(([id, ch]) => { if (ch.length > 0) toCollapse.add(id); });
            const childSet = new Set(allEdges.map(e => e.target));
            allNodes.filter(n => !childSet.has(n.id)).forEach(n => toCollapse.delete(n.id));
            setCollapsed(toCollapse);
          }} className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-2 hover:bg-neutral-50 transition-colors" title="Collapse all branches">
            <ArrowsInSimple size={14} weight="bold" /><span className="text-[10px] font-mono uppercase tracking-wider">Collapse</span>
          </button>
          <button data-testid="fit-view-btn" onClick={handleFitView}
            className="bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-2 hover:bg-neutral-50 transition-colors" title="Fit tree to viewport">
            <ArrowsOutSimple size={14} weight="bold" /><span className="text-[10px] font-mono uppercase tracking-wider">Fit View</span>
          </button>
        </div>
      )}

      {!fundId ? (
        <div className="flex items-center justify-center h-full canvas-grid">
          <div className="flex flex-col items-center gap-4 max-w-xs text-center">
            <div className="w-16 h-16 border-2 border-neutral-300 flex items-center justify-center"><TreeStructure size={32} weight="thin" className="text-neutral-300" /></div>
            <div>
              <p className="text-sm font-bold font-heading text-neutral-600">No Fund Selected</p>
              <p className="text-xs font-mono text-neutral-400 mt-1">Select a fund from the sidebar to visualize its entity structure</p>
            </div>
          </div>
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full canvas-grid">
          <p className="text-sm font-bold font-heading text-neutral-600">No Entities Found</p>
        </div>
      ) : (
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions} fitView fitViewOptions={{ padding: 0.15, maxZoom: 0.8 }}
          minZoom={0.02} maxZoom={2} proOptions={{ hideAttribution: true }}>
          <Controls className="!rounded-none !border-2 !border-neutral-900 !shadow-[4px_4px_0px_0px_rgba(9,9,11,1)]" showInteractive={false} />
          <MiniMap nodeColor={minimapNodeColor} nodeStrokeWidth={2} nodeBorderRadius={0} maskColor="rgba(0,0,0,0.08)"
            className="!rounded-none !border-2 !border-neutral-900 !shadow-[4px_4px_0px_0px_rgba(9,9,11,1)]" />
          <Background color="#D4D4D8" gap={24} size={1} />
        </ReactFlow>
      )}

      {selectedEntityId && dataset && (
        <EntityDrawer entityId={selectedEntityId} entities={dataset.entities} onClose={() => setSelectedEntityId(null)} />
      )}
    </div>
  );
}

export default function EntityTree({ fundId, dataset }) {
  return (
    <ReactFlowProvider>
      <EntityTreeInner fundId={fundId} dataset={dataset} />
    </ReactFlowProvider>
  );
}
