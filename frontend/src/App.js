import { useState, useCallback, useEffect } from 'react';
import '@/App.css';
import Sidebar from '@/components/Sidebar';
import EntityTree from '@/components/EntityTree';
import EntityDrawer from '@/components/EntityDrawer';
import UploadModal from '@/components/UploadModal';
import { saveToStorage, loadFromStorage, clearStorage } from '@/lib/dataService';

function App() {
  // Core data state — null means no data loaded yet
  const [dataset, setDataset] = useState(null);
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [drawerEntityId, setDrawerEntityId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [ready, setReady] = useState(false);

  // Restore from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) setDataset(stored);
    setReady(true);
  }, []);

  const handleDataLoaded = useCallback((data) => {
    setDataset(data);
    saveToStorage(data);
    setSelectedFundId(null);
    setDrawerEntityId(null);
    setShowUpload(false);
  }, []);

  const handleReupload = useCallback(() => {
    setShowUpload(true);
  }, []);

  const handleClearData = useCallback(() => {
    clearStorage();
    setDataset(null);
    setSelectedFundId(null);
    setDrawerEntityId(null);
    setShowUpload(false);
  }, []);

  const hasData = dataset !== null;

  // Wait for localStorage check before rendering
  if (!ready) return null;

  // Show initial upload modal if no data loaded
  if (!hasData && !showUpload) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-100" data-testid="app-root">
        <UploadModal
          isInitial={true}
          onClose={() => {}}
          onDataLoaded={handleDataLoaded}
        />
      </div>
    );
  }

  if (!hasData && showUpload) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-100" data-testid="app-root">
        <UploadModal
          isInitial={true}
          onClose={() => setShowUpload(false)}
          onDataLoaded={handleDataLoaded}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-100" data-testid="app-root">
      <Sidebar
        selectedFundId={selectedFundId}
        onFundSelect={setSelectedFundId}
        onEntityClick={setDrawerEntityId}
        onUploadClick={handleReupload}
        onClearData={handleClearData}
        dataset={dataset}
      />
      <div className="flex-1 relative h-full">
        <EntityTree fundId={selectedFundId} dataset={dataset} />
        {drawerEntityId != null && (
          <EntityDrawer
            entityId={drawerEntityId}
            entities={dataset.entities}
            onClose={() => setDrawerEntityId(null)}
          />
        )}
      </div>
      {showUpload && (
        <UploadModal
          isInitial={false}
          onClose={() => setShowUpload(false)}
          onDataLoaded={handleDataLoaded}
        />
      )}
    </div>
  );
}

export default App;
