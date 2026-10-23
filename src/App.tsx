import { useState, useEffect, useCallback } from 'react';
import Sidebar, { type View } from '@/components/Sidebar';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import MyBooks from '@/components/MyBooks';
import ChatAssistant from '@/components/ChatAssistant';
import DemoScenarios from '@/components/DemoScenarios';
import ActivityHistory from '@/components/ActivityHistory';
import CatalogueSearch from '@/components/CatalogueSearch';
import { libraryStore } from '@/lib/libraryStore';
import type { SearchMode } from '@/lib/types';

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setTick] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchMode>('live');

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Subscribe to store changes so all views stay in sync.
  useEffect(() => libraryStore.subscribe(refresh), [refresh]);

  const books = libraryStore.getAllBooks();
  const holds = libraryStore.getHolds();
  const activity = libraryStore.getActivity();
  const stats = libraryStore.getStats();

  const toggleMode = useCallback(() => {
    setSearchMode((m) => (m === 'live' ? 'demo' : 'live'));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
      <Sidebar
        current={view}
        onNavigate={setView}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        searchMode={searchMode}
        onToggleMode={toggleMode}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {view === 'dashboard' && (
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
              <Dashboard stats={stats} books={books} holds={holds} activity={activity} onNavigate={setView} />
            </div>
          )}
          {view === 'books' && (
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
              <MyBooks onChanged={refresh} />
            </div>
          )}
          {view === 'catalogue' && (
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
              <CatalogueSearch searchMode={searchMode} />
            </div>
          )}
          {view === 'assistant' && <ChatAssistant onChanged={refresh} searchMode={searchMode} />}
          {view === 'demo' && (
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
              <DemoScenarios onChanged={refresh} />
            </div>
          )}
          {view === 'history' && (
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
              <ActivityHistory onChanged={refresh} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
