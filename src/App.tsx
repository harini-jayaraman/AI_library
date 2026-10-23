import { useState, useEffect, useCallback } from 'react';
import Sidebar, { type View } from '@/components/Sidebar';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import MyBooks from '@/components/MyBooks';
import ChatAssistant from '@/components/ChatAssistant';
import DemoScenarios from '@/components/DemoScenarios';
import ActivityHistory from '@/components/ActivityHistory';
import CatalogueSearch from '@/components/CatalogueSearch';
import Notifications from '@/components/Notifications';
import Login from '@/components/Login';
import { libraryStore } from '@/lib/libraryStore';
import { notificationStore } from '@/lib/notificationStore';
import { AuthProvider, useAuth } from '@/lib/authContext';
import type { SearchMode } from '@/lib/types';

function AppInner() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setTick] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchMode>('live');
  const [demoMode, setDemoMode] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => libraryStore.subscribe(refresh), [refresh]);
  useEffect(() => notificationStore.subscribe(refresh), [refresh]);

  const isAuthenticated = Boolean(user) || demoMode;

  useEffect(() => {
    if (user) {
      notificationStore.loadForUser(user.id);
      libraryStore.checkDueDateNotifications();
    } else if (demoMode) {
      notificationStore.loadForUser('demo');
      libraryStore.checkDueDateNotifications();
    }
  }, [user, demoMode]);

  const toggleMode = useCallback(() => {
    setSearchMode((m) => (m === 'live' ? 'demo' : 'live'));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-navy-700" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onDemoMode={() => { setDemoMode(true); setView('dashboard'); }} />;
  }

  const books = libraryStore.getAllBooks();
  const holds = libraryStore.getHolds();
  const activity = libraryStore.getActivity();
  const stats = libraryStore.getStats();

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
        <Header
          onOpenMobile={() => setMobileOpen(true)}
          onNavigate={setView}
          isDemoMode={demoMode}
          onExitDemoMode={() => { setDemoMode(false); setView('dashboard'); }}
        />
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
          {view === 'notifications' && (
            <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
              <Notifications />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
