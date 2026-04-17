import { useState, useMemo } from 'react';
import { MagnifyingGlass, FunnelSimple, TreeStructure, X, CaretDown, UploadSimple, Trash } from '@phosphor-icons/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { searchEntities } from '@/lib/dataService';

export default function Sidebar({ selectedFundId, onFundSelect, onEntityClick, onUploadClick, onClearData, dataset }) {
  const [search, setSearch] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const funds = dataset?.funds || [];
  const filters = dataset?.filters || { jurisdictions: [], entity_types: [] };

  // Compute filtered entities
  const { entities, total } = useMemo(() => {
    if (!dataset) return { entities: [], total: 0 };
    return searchEntities(dataset.entities, {
      search: search || undefined,
      jurisdiction: jurisdiction || undefined,
      entityType: entityType || undefined,
      fundId: selectedFundId ?? undefined,
      limit: 50,
    });
  }, [dataset, search, jurisdiction, entityType, selectedFundId]);

  const clearFilters = () => { setSearch(''); setJurisdiction(''); setEntityType(''); };
  const hasActiveFilters = search || jurisdiction || entityType;

  return (
    <div className="w-80 flex-shrink-0 bg-white border-r-2 border-neutral-900 h-full flex flex-col z-20" data-testid="sidebar">
      {/* Header */}
      <div className="p-4 border-b-2 border-neutral-900">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <TreeStructure size={20} weight="bold" className="text-neutral-900" />
            <h1 className="text-lg font-bold font-heading tracking-tight text-neutral-900">Entity Map</h1>
          </div>
          <button data-testid="upload-data-btn" onClick={onUploadClick}
            className="flex items-center gap-1.5 bg-neutral-900 text-white px-2.5 py-1.5 hover:bg-neutral-800 transition-colors"
            title="Upload new CSV dataset">
            <UploadSimple size={12} weight="bold" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Upload</span>
          </button>
          <button data-testid="clear-data-btn" onClick={onClearData}
            className="flex items-center gap-1.5 border-2 border-neutral-300 text-neutral-500 px-2 py-1 hover:border-red-600 hover:text-red-600 transition-colors"
            title="Clear data and return to upload screen">
            <Trash size={12} weight="bold" />
          </button>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">Private Equity Structure</span>
      </div>

      {/* Fund Selector */}
      <div className="p-4 border-b border-neutral-200">
        <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500 block mb-1.5">Select Fund</label>
        <Select value={selectedFundId ? String(selectedFundId) : undefined} onValueChange={v => onFundSelect(v ? Number(v) : null)}>
          <SelectTrigger data-testid="fund-selector" className="border-2 border-neutral-300 rounded-none px-3 py-2 text-sm focus:border-neutral-900 focus:ring-0 w-full font-mono bg-white h-10">
            <SelectValue placeholder="Choose a fund..." />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-neutral-900 font-mono max-h-60">
            {funds.map(f => (
              <SelectItem key={f.fund_id} value={String(f.fund_id)} className="rounded-none text-sm font-mono" data-testid={`fund-option-${f.fund_id}`}>
                {f.fund_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="p-4 pb-2 border-b border-neutral-200">
        <div className="relative">
          <MagnifyingGlass size={14} weight="bold" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input data-testid="entity-search" placeholder="Search entities..." value={search} onChange={e => setSearch(e.target.value)}
            className="border-2 border-neutral-300 rounded-none pl-8 pr-3 py-2 text-sm focus:border-neutral-900 focus-visible:ring-0 w-full font-mono bg-white" />
        </div>
        <button data-testid="filter-toggle" onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 mt-2 text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900 transition-colors">
          <FunnelSimple size={12} weight="bold" /> Filters
          <CaretDown size={10} weight="bold" className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          {hasActiveFilters && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full ml-1" />}
        </button>

        {showFilters && (
          <div className="mt-2 space-y-2 pb-2">
            <Select value={jurisdiction || undefined} onValueChange={v => setJurisdiction(v === '_all' ? '' : v)}>
              <SelectTrigger data-testid="jurisdiction-filter" className="border-2 border-neutral-300 rounded-none px-3 py-1.5 text-xs focus:border-neutral-900 focus:ring-0 w-full font-mono bg-white h-8">
                <SelectValue placeholder="All Jurisdictions" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-neutral-900 font-mono max-h-48">
                <SelectItem value="_all" className="rounded-none text-xs font-mono">All Jurisdictions</SelectItem>
                {filters.jurisdictions.map(j => <SelectItem key={j} value={j} className="rounded-none text-xs font-mono">{j}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={entityType || undefined} onValueChange={v => setEntityType(v === '_all' ? '' : v)}>
              <SelectTrigger data-testid="entity-type-filter" className="border-2 border-neutral-300 rounded-none px-3 py-1.5 text-xs focus:border-neutral-900 focus:ring-0 w-full font-mono bg-white h-8">
                <SelectValue placeholder="All Entity Types" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-neutral-900 font-mono">
                <SelectItem value="_all" className="rounded-none text-xs font-mono">All Entity Types</SelectItem>
                {filters.entity_types.map(t => <SelectItem key={t} value={t} className="rounded-none text-xs font-mono">{t}</SelectItem>)}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <button data-testid="clear-filters" onClick={clearFilters}
                className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-red-600 hover:text-red-800 transition-colors">
                <X size={10} weight="bold" /> Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Entity list */}
      <div className="flex-1 min-h-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500">Entities</span>
          <span className="text-[10px] font-mono text-neutral-400">{total} total</span>
        </div>
        <ScrollArea className="h-[calc(100%-32px)]">
          <div className="px-2 pb-4">
            {entities.length === 0 ? (
              <div className="px-2 py-8 text-center text-xs font-mono text-neutral-400">No entities found</div>
            ) : (
              entities.map(entity => (
                <button key={entity.ENTITY_ID} data-testid={`entity-list-item-${entity.ENTITY_ID}`}
                  onClick={() => onEntityClick(entity.ENTITY_ID)}
                  className="w-full text-left px-2 py-2 border-b border-neutral-100 hover:bg-neutral-50 transition-colors group">
                  <p className="text-xs font-mono font-bold text-neutral-900 truncate group-hover:text-blue-700 transition-colors">{entity.COMPANY_NAME}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entity.ENTITY_TYPE && <span className="text-[9px] font-mono uppercase text-neutral-400">{entity.ENTITY_TYPE}</span>}
                    {entity.JURISDICTION && <span className="text-[9px] font-mono text-neutral-400 truncate">{entity.JURISDICTION}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
