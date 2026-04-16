import { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer } from 'reactflow';

const OwnershipEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isGP = data?.relation_type === 'GENERAL_PARTNER';

  return (
    <>
      <path
        id={id}
        className={isGP ? 'react-flow__edge-path' : 'react-flow__edge-path'}
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isGP ? '#EA580C' : '#2563EB',
          strokeWidth: 2,
          strokeDasharray: isGP ? '6 4' : 'none',
          fill: 'none',
        }}
      />
      <EdgeLabelRenderer>
        <div
          data-testid={`edge-label-${id}`}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <span className={`
            text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5
            bg-white border-2 text-neutral-900
            ${isGP ? 'border-orange-600' : 'border-neutral-900'}
          `}>
            {data?.ownership || ''}
            {isGP && <span className="ml-1 text-orange-600">GP</span>}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

OwnershipEdge.displayName = 'OwnershipEdge';

export default OwnershipEdge;
