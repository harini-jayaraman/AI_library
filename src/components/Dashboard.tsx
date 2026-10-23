import { Clock, AlertTriangle, Sparkles, History } from 'lucide-react';
import type { Book, Hold, ActivityEntry, DashboardStats } from '@/lib/types';
import StatsCards from './StatsCards';
import StatusBadge from './StatusBadge';
import type { View } from './Sidebar';
import { formatDate, daysUntil } from '@/lib/policy';

interface Props {
  stats: DashboardStats;
  books: Book[];
  holds: Hold[];
  activity: ActivityEntry[];
  onNavigate: (v: View) => void;
  userName: string;
}

export default function Dashboard({ stats, books, holds, activity, onNavigate, userName }: Props) {
  const borrowed = books.filter((b) => !b.inCatalogueOnly);
  const dueSoonBooks = borrowed.filter((b) => {
    const d = daysUntil(b.dueDate);
    return d >= 0 && d <= 2;
  });
  const needsAttention = borrowed.filter((b) => b.status === 'reserved' || b.status === 'limit_reached' || b.status === 'overdue');
  const recentActivity = activity.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {userName || 'there'}</h1>
        <p className="mt-1 text-sm text-gray-500">Here's what's happening with your library account today.</p>
      </div>

      <StatsCards stats={stats} onNavigate={onNavigate} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-gray-900">Due Soon</h2>
            </div>
            <button onClick={() => onNavigate('books')} className="text-sm font-medium text-navy-700 hover:text-navy-900">
              View all
            </button>
          </div>
          {dueSoonBooks.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">No books due in the next 2 days.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {dueSoonBooks.map((b) => {
                const d = daysUntil(b.dueDate);
                return (
                  <li key={b.id} className="flex items-center gap-3 py-3">
                    <div className={`h-10 w-2 rounded-full bg-gradient-to-b ${b.coverColor}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{b.title}</p>
                      <p className="truncate text-xs text-gray-500">{b.author} · {b.edition}</p>
                    </div>
                    <span className={`text-xs font-medium ${d <= 1 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`}
                    </span>
                    <StatusBadge status={b.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="font-semibold text-gray-900">Active Reservations</h2>
          </div>
          {holds.length === 0 ? (
            <div className="py-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">No active reservations.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {holds.map((h) => (
                <li key={h.id} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-900">{h.bookTitle}</p>
                  <p className="text-xs text-gray-500">{h.author}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={`font-medium ${h.status === 'ready' ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {h.status === 'ready' ? 'Ready to pick up' : `Queue position #${h.queuePosition}`}
                    </span>
                    {h.estimatedAvailable && <span className="text-gray-400">~{formatDate(h.estimatedAvailable)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {needsAttention.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold text-gray-900">Needs Attention</h2>
          </div>
          <ul className="space-y-2">
            {needsAttention.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{b.title}</p>
                  <p className="text-xs text-gray-500">
                    {b.status === 'reserved'
                      ? `Reserved by ${b.reservedBy} · expected back ${formatDate(b.expectedReturnDate ?? '')}`
                      : b.status === 'overdue'
                        ? `Overdue · ${Math.abs(daysUntil(b.dueDate))} days late`
                        : `Renewal limit reached (${b.renewalsUsed}/${b.maxRenewals})`}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-navy-600" />
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <button onClick={() => onNavigate('history')} className="text-sm font-medium text-navy-700 hover:text-navy-900">
            View all
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <div className="py-8 text-center">
            <History className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-400">No activity yet. Try renewing a book or running a demo scenario.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    a.result === 'success' ? 'bg-emerald-500' : a.result === 'rejected' ? 'bg-gray-400' : a.result === 'failed' ? 'bg-rose-500' : 'bg-sky-500'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-700">{a.detail}</p>
                  {a.bookTitle && <p className="truncate text-xs text-gray-400">{a.bookTitle}</p>}
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(a.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
