import { useState } from 'react';
import '@/App.css';
import Sidebar from '@/components/Sidebar';
import EntityTree from '@/components/EntityTree';
import EntityDrawer from '@/components/EntityDrawer';

function App() {
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [drawerEntityId, setDrawerEntityId] = useState(null);

  const handleEntityClickFromSidebar = (entityId) => {
    setDrawerEntityId(entityId);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-100" data-testid="app-root">
      <Sidebar
        selectedFundId={selectedFundId}
        onFundSelect={setSelectedFundId}
        onEntityClick={handleEntityClickFromSidebar}
      />
      <div className="flex-1 relative h-full">
        <EntityTree fundId={selectedFundId} />
        {/* Sidebar-triggered drawer (separate from tree-click drawer) */}
        {drawerEntityId && (
          <EntityDrawer
            entityId={drawerEntityId}
            onClose={() => setDrawerEntityId(null)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
