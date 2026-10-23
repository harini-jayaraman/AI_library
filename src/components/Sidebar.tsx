import { LayoutDashboard, BookOpen, MessageSquare, FlaskConical, History, X, Search, Wifi, FlaskConical as Flask } from 'lucide-react';
import type { SearchMode } from '@/lib/types';

export type View = 'dashboard' | 'books' | 'catalogue' | 'assistant' | 'demo' | 'history';

interface Props {
  current: View;
  onNavigate: (v: View) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  searchMode: SearchMode;
  onToggleMode: () => void;
}

const nav: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'books', label: 'My Books', icon: BookOpen },
  { id: 'catalogue', label: 'Catalogue Search', icon: Search },
  { id: 'assistant', label: 'AI Assistant', icon: MessageSquare },
  { id: 'demo', label: 'Demo Scenarios', icon: FlaskConical },
  { id: 'history', label: 'Activity History', icon: History },
];

export default function Sidebar({ current, onNavigate, mobileOpen, onCloseMobile, searchMode, onToggleMode }: Props) {
  const isLive = searchMode === 'live';

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onCloseMobile} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 text-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-navy-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Library Agent</p>
              <p className="text-[11px] text-navy-200">Hold &amp; Renewal</p>
            </div>
          </div>
          <button
            className="rounded-md p-1 text-navy-200 hover:bg-white/10 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? 'bg-white/15 text-white' : 'text-navy-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <button
            onClick={onToggleMode}
            className="w-full rounded-lg p-3 text-left text-xs ring-1 transition hover:ring-white/20"
            style={{ background: isLive ? 'rgba(16,185,129,0.12)' : 'rgba(168,85,247,0.12)' }}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">
                {isLive ? 'LIVE KOHA MODE' : 'DEMO MODE'}
              </span>
              <span
                className="inline-flex h-5 w-9 items-center rounded-full p-0.5 transition"
                style={{ background: isLive ? '#10b981' : '#a855f7' }}
              >
                <span
                  className="h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: isLive ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </span>
            </div>
            <p className="mt-1.5 leading-relaxed text-navy-100">
              {isLive ? (
                <span className="flex items-center gap-1.5"><Wifi className="h-3 w-3 text-emerald-400" /> Catalogue search uses the live Koha server. Renewals &amp; holds remain simulated.</span>
              ) : (
                <span className="flex items-center gap-1.5"><Flask className="h-3 w-3 text-purple-400" /> All searches and actions use local demo data. Switch to live to query the real Koha catalogue.</span>
              )}
            </p>
          </button>
        </div>
      </aside>
    </>
  );
}
