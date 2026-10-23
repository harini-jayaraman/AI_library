import { BookOpen, Clock, Bookmark, CheckCircle2 } from 'lucide-react';
import type { DashboardStats } from '@/lib/types';
import type { View } from './Sidebar';

const cards: {
  key: keyof DashboardStats;
  label: string;
  icon: typeof BookOpen;
  iconBg: string;
  tint: string;
  view: View;
}[] = [
  { key: 'totalBorrowed', label: 'Borrowed Books', icon: BookOpen, iconBg: 'bg-navy-100', tint: 'text-navy-700', view: 'books' },
  { key: 'dueSoon', label: 'Due Soon', icon: Clock, iconBg: 'bg-amber-100', tint: 'text-amber-600', view: 'books' },
  { key: 'activeHolds', label: 'Active Reservations', icon: Bookmark, iconBg: 'bg-purple-100', tint: 'text-purple-600', view: 'books' },
  { key: 'completedActions', label: 'Completed Actions', icon: CheckCircle2, iconBg: 'bg-emerald-100', tint: 'text-emerald-600', view: 'history' },
];

export default function StatsCards({ stats, onNavigate }: { stats: DashboardStats; onNavigate: (v: View) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <button
            key={c.key}
            onClick={() => onNavigate(c.view)}
            className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
              <Icon className={`h-6 w-6 ${c.tint}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats[c.key]}</p>
              <p className="text-sm text-gray-500">{c.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
