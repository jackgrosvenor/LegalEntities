import { useState, useCallback } from 'react';
import '@/App.css';
import Sidebar from '@/components/Sidebar';
import EntityTree from '@/components/EntityTree';
import EntityDrawer from '@/components/EntityDrawer';
import UploadModal from '@/components/UploadModal';

function App() {
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [drawerEntityId, setDrawerEntityId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const handleEntityClickFromSidebar = (entityId) => {
    setDrawerEntityId(entityId);
  };

  const handleUploadSuccess = useCallback(() => {
    setSelectedFundId(null);
    setDrawerEntityId(null);
    setDataVersion(v => v + 1);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-100" data-testid="app-root">
      <Sidebar
        selectedFundId={selectedFundId}
        onFundSelect={setSelectedFundId}
        onEntityClick={handleEntityClickFromSidebar}
        onUploadClick={() => setShowUpload(true)}
        dataVersion={dataVersion}
      />
      <div className="flex-1 relative h-full">
        <EntityTree fundId={selectedFundId} key={dataVersion} />
        {drawerEntityId && (
          <EntityDrawer
            entityId={drawerEntityId}
            onClose={() => setDrawerEntityId(null)}
          />
        )}
      </div>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}

export default App;
