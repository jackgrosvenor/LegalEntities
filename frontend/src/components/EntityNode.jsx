import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Buildings, MapPin } from '@phosphor-icons/react';

const TYPE_LABELS = {
  LimitedCompany: 'Ltd',
  LimitedPartnership: 'LP',
  PublicLimitedCompany: 'PLC',
  Trust: 'Trust',
};

const EntityNode = memo(({ data, selected }) => {
  const isTop = data.is_top;

  return (
    <div
      data-testid={`tree-node-${data.entity_id}`}
      className={`
        border-2 border-neutral-900 p-3 min-w-[200px] max-w-[260px] cursor-pointer
        transition-all duration-150 ease-out
        ${isTop
          ? 'bg-neutral-900 text-white shadow-[4px_4px_0px_0px_rgba(37,99,235,1)]'
          : 'bg-white text-neutral-900 shadow-[4px_4px_0px_0px_rgba(9,9,11,1)]'
        }
        ${selected ? '-translate-y-1 shadow-[6px_6px_0px_0px_rgba(9,9,11,1)]' : ''}
        hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(9,9,11,1)]
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-neutral-900 !w-2 !h-2 !rounded-none !border-0" />

      <div className="flex items-start gap-2 mb-1.5">
        <Buildings size={14} weight="bold" className={isTop ? 'text-blue-400 mt-0.5 flex-shrink-0' : 'text-neutral-400 mt-0.5 flex-shrink-0'} />
        <p className="text-sm font-bold tracking-tight leading-tight break-words" title={data.label}>
          {data.label}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {data.entity_type && (
          <span className={`
            text-[10px] font-mono uppercase px-1.5 py-0.5 border
            ${isTop ? 'border-white/30 text-white/80' : 'border-neutral-900 bg-neutral-100 text-neutral-900'}
          `}>
            {TYPE_LABELS[data.entity_type] || data.entity_type}
          </span>
        )}
        {data.jurisdiction && (
          <span className={`flex items-center gap-0.5 text-[10px] font-mono ${isTop ? 'text-white/60' : 'text-neutral-500'}`}>
            <MapPin size={10} weight="bold" />
            {data.jurisdiction.length > 20 ? data.jurisdiction.substring(0, 18) + '...' : data.jurisdiction}
          </span>
        )}
      </div>

      {data.asset_name && (
        <div className={`mt-1.5 text-[10px] font-mono ${isTop ? 'text-blue-300' : 'text-blue-600'}`}>
          {data.asset_name}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-neutral-900 !w-2 !h-2 !rounded-none !border-0" />
    </div>
  );
});

EntityNode.displayName = 'EntityNode';

export default EntityNode;
