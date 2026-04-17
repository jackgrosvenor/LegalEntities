import { useState, useRef } from 'react';
import { X, UploadSimple, FileText, CheckCircle, WarningCircle, Spinner } from '@phosphor-icons/react';
import { parseFile, validateEntities, validateRelations, getFunds, getFilters } from '@/lib/dataService';

export default function UploadModal({ onClose, onDataLoaded, isInitial }) {
  const [masterFile, setMasterFile] = useState(null);
  const [relationsFile, setRelationsFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const masterRef = useRef(null);
  const relationsRef = useRef(null);

  const handleUpload = async () => {
    if (!masterFile || !relationsFile) return;
    setUploading(true);
    setResult(null);

    try {
      const [entities, relations] = await Promise.all([
        parseFile(masterFile),
        parseFile(relationsFile),
      ]);

      const entityErr = validateEntities(entities);
      if (entityErr) { setResult({ success: false, message: entityErr }); setUploading(false); return; }

      const relErr = validateRelations(relations);
      if (relErr) { setResult({ success: false, message: relErr }); setUploading(false); return; }

      const funds = getFunds(entities);
      const filters = getFilters(entities);

      setResult({
        success: true,
        message: `Loaded ${entities.length} entities, ${relations.length} relations across ${funds.length} funds.`,
      });

      onDataLoaded({ entities, relations, funds, filters });
    } catch (err) {
      setResult({ success: false, message: err.message || 'Failed to parse CSV files.' });
    } finally {
      setUploading(false);
    }
  };

  const FileSlot = ({ label, file, onSelect, inputRef, testId }) => (
    <div className="border-2 border-dashed border-neutral-300 hover:border-neutral-900 transition-colors p-4 cursor-pointer"
      onClick={() => inputRef.current?.click()}
      data-testid={testId}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => onSelect(e.target.files?.[0] || null)}
      />
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 flex items-center justify-center border-2 ${file ? 'border-green-600 bg-green-50' : 'border-neutral-300 bg-neutral-50'}`}>
          {file ? <CheckCircle size={20} weight="bold" className="text-green-600" /> : <FileText size={20} weight="bold" className="text-neutral-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-500 mb-0.5">{label}</p>
          {file ? (
            <p className="text-xs font-mono font-bold text-neutral-900 truncate">{file.name}</p>
          ) : (
            <p className="text-xs font-mono text-neutral-400">Click to select CSV file</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="upload-modal">
      <div className="absolute inset-0 bg-black/50" onClick={isInitial ? undefined : onClose} />
      <div className="relative bg-white border-2 border-neutral-900 shadow-[8px_8px_0px_0px_rgba(9,9,11,1)] w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b-2 border-neutral-900 bg-neutral-900 text-white">
          <div>
            <h2 className="text-base font-bold font-heading tracking-tight">
              {isInitial ? 'Load Entity Data' : 'Upload New Dataset'}
            </h2>
            <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
              {isInitial ? 'Upload your CSV files to get started' : 'This will replace all current data'}
            </p>
          </div>
          {!isInitial && (
            <button data-testid="upload-modal-close" onClick={onClose} className="p-1 hover:bg-white/10 transition-colors">
              <X size={18} weight="bold" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          <FileSlot label="Entity Master" file={masterFile} onSelect={setMasterFile} inputRef={masterRef} testId="upload-entity-master" />
          <FileSlot label="Entity Relations" file={relationsFile} onSelect={setRelationsFile} inputRef={relationsRef} testId="upload-entity-relations" />

          <div className="border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-[10px] font-mono text-neutral-500 leading-relaxed">
              <span className="font-bold text-neutral-700">Entity Master</span> must include: ENTITY_ID, COMPANY_NAME
              <br />
              <span className="font-bold text-neutral-700">Entity Relations</span> must include: PARENT_ID, CHILD_ID
              <br />
              Both files should be UTF-8 encoded CSV format.
            </p>
          </div>

          {result && (
            <div className={`border-2 p-3 flex items-start gap-2 ${result.success ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`} data-testid="upload-result">
              {result.success
                ? <CheckCircle size={16} weight="bold" className="text-green-600 mt-0.5 flex-shrink-0" />
                : <WarningCircle size={16} weight="bold" className="text-red-600 mt-0.5 flex-shrink-0" />
              }
              <p className={`text-xs font-mono ${result.success ? 'text-green-800' : 'text-red-800'}`}>{result.message}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 flex gap-2 justify-end">
          {!isInitial && (
            <button data-testid="upload-cancel-btn" onClick={onClose}
              className="border-2 border-neutral-300 px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-neutral-600 hover:bg-neutral-50 transition-colors">
              Cancel
            </button>
          )}
          <button
            data-testid="upload-submit-btn"
            onClick={handleUpload}
            disabled={!masterFile || !relationsFile || uploading}
            className="bg-neutral-900 text-white border-2 border-neutral-900 px-4 py-2 text-[10px] font-mono uppercase tracking-wider hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <><Spinner size={12} weight="bold" className="animate-spin" /> Processing...</>
            ) : (
              <><UploadSimple size={12} weight="bold" /> {isInitial ? 'Load Data' : 'Upload & Replace'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
