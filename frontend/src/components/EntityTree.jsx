import { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import EntityNode from './EntityNode';
import OwnershipEdge from './OwnershipEdge';
import EntityDrawer from './EntityDrawer';
import { TreeStructure, Spinner } from '@phosphor-icons/react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const nodeTypes = { entityNode: EntityNode };
const edgeTypes = { ownershipEdge: OwnershipEdge };

const NODE_WIDTH = 240;
const NODE_HEIGHT = 90;

function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export default function EntityTree({ fundId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [fundName, setFundName] = useState('');

  useEffect(() => {
    if (!fundId) {
      setNodes([]);
      setEdges([]);
      setFundName('');
      return;
    }

    setLoading(true);
    setSelectedEntityId(null);
    axios.get(`${API}/funds/${fundId}/tree`)
      .then(res => {
        const { nodes: rawNodes, edges: rawEdges, fund_name } = res.data;
        setFundName(fund_name || '');

        const styledEdges = rawEdges.map(e => ({
          ...e,
          markerEnd: { type: MarkerType.ArrowClosed, color: e.data?.relation_type === 'GENERAL_PARTNER' ? '#EA580C' : '#2563EB' },
        }));

        if (rawNodes.length > 0) {
          const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, styledEdges);
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
        } else {
          setNodes([]);
          setEdges([]);
        }
      })
      .catch(err => {
        console.error('Failed to load tree:', err);
        setNodes([]);
        setEdges([]);
      })
      .finally(() => setLoading(false));
  }, [fundId, setNodes, setEdges]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedEntityId(node.data.entity_id);
  }, []);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'ownershipEdge',
  }), []);

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
            {nodes.length} entities &middot; {edges.length} relations
          </span>
        </div>
      )}

      {/* Legend */}
      {fundId && nodes.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)] px-3 py-2 flex items-center gap-4" data-testid="tree-legend">
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
            <span className="text-[10px] font-mono text-neutral-600">Top of Structure</span>
          </div>
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
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls
            className="!rounded-none !border-2 !border-neutral-900 !shadow-[4px_4px_0px_0px_rgba(9,9,11,1)]"
            showInteractive={false}
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
