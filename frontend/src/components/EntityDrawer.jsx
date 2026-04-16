import { useEffect, useState } from 'react';
import { X, Buildings, MapPin, CurrencyDollar, TreeStructure, Tag } from '@phosphor-icons/react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const InfoRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="border-b border-neutral-200 py-2.5">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500 block mb-0.5">{label}</span>
      <span className="text-sm font-mono text-neutral-900 break-words">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</span>
    </div>
  );
};

export default function EntityDrawer({ entityId, onClose }) {
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    axios.get(`${API}/entities/${entityId}`)
      .then(res => setEntity(res.data.entity))
      .catch(() => setEntity(null))
      .finally(() => setLoading(false));
  }, [entityId]);

  if (!entityId) return null;

  return (
    <div
      data-testid="entity-drawer"
      className="w-96 bg-white border-l-2 border-neutral-900 shadow-[-8px_0px_0px_0px_rgba(0,0,0,0.1)] h-full absolute right-0 top-0 z-30 overflow-y-auto transform transition-transform duration-200 ease-out"
    >
      {/* Header */}
      <div className="sticky top-0 bg-neutral-900 text-white p-4 flex items-start justify-between z-10">
        <div className="flex-1 min-w-0 pr-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 block mb-1">Entity Detail</span>
          <h2 className="text-base font-bold font-heading tracking-tight leading-tight break-words">
            {loading ? 'Loading...' : entity?.COMPANY_NAME || 'Unknown'}
          </h2>
        </div>
        <button
          data-testid="drawer-close"
          onClick={onClose}
          className="p-1 hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-sm font-mono text-neutral-500">Loading entity details...</div>
      ) : entity ? (
        <div className="p-4">
          {/* Quick badges */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {entity.ENTITY_TYPE && (
              <span className="border border-neutral-900 bg-neutral-100 text-[10px] font-mono uppercase px-1.5 py-0.5 text-neutral-900 flex items-center gap-1">
                <Tag size={10} weight="bold" />
                {entity.ENTITY_TYPE}
              </span>
            )}
            {entity.IS_TOP_OF_STRUCTURE && (
              <span className="border border-blue-600 bg-blue-50 text-[10px] font-mono uppercase px-1.5 py-0.5 text-blue-700 flex items-center gap-1">
                <TreeStructure size={10} weight="bold" />
                TOP OF STRUCTURE
              </span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-0">
            <InfoRow label="Entity ID" value={entity.ENTITY_ID} />
            <InfoRow label="Company Name" value={entity.COMPANY_NAME} />
            <InfoRow label="Jurisdiction" value={entity.JURISDICTION} />
            <InfoRow label="Entity Type" value={entity.ENTITY_TYPE} />
            <InfoRow label="Fund Name" value={entity.FUND_NAME} />
            <InfoRow label="Fund ID" value={entity.FUND_ID} />
            <InfoRow label="Asset Name" value={entity.ASSET_NAME} />
            <InfoRow label="Asset ID" value={entity.ASSET_ID} />
            <InfoRow label="Editor" value={entity.EDITOR} />
            <InfoRow label="Last Updated" value={entity.AS_OF} />
            {entity.SYMBOLOGIES && (
              <div className="border-b border-neutral-200 py-2.5">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500 block mb-1">Symbologies</span>
                <pre className="text-xs font-mono text-neutral-900 bg-neutral-50 border border-neutral-200 p-2 overflow-x-auto whitespace-pre-wrap">
                  {typeof entity.SYMBOLOGIES === 'object'
                    ? JSON.stringify(entity.SYMBOLOGIES, null, 2)
                    : entity.SYMBOLOGIES}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 text-sm font-mono text-neutral-500">Entity not found.</div>
      )}
    </div>
  );
}
