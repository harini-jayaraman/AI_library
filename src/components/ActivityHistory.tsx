import { History, CheckCircle2, XCircle, AlertCircle, Info, RotateCcw } from 'lucide-react';
import { libraryStore } from '@/lib/libraryStore';
import type { ActivityEntry } from '@/lib/types';

const resultConfig: Record<ActivityEntry['result'], { icon: typeof Info; tint: string; label: string }> = {
  success: { icon: CheckCircle2, tint: 'text-emerald-600', label: 'Success' },
  rejected: { icon: AlertCircle, tint: 'text-gray-500', label: 'Rejected' },
  failed: { icon: XCircle, tint: 'text-rose-600', label: 'Failed' },
  info: { icon: Info, tint: 'text-sky-600', label: 'Info' },
};

const actionLabel: Record<ActivityEntry['action'], string> = {
  renew: 'Renewal',
  reserve: 'Reservation',
  renew_blocked: 'Renewal Blocked',
  reserve_blocked: 'Reservation Blocked',
  cancelled: 'Cancelled',
  query: 'Query',
  search: 'Catalogue Search',
};

export default function ActivityHistory({ onChanged }: { onChanged: () => void }) {
  const activity = libraryStore.getActivity();

  const clearHistory = () => {
    localStorage.removeItem('ai-library-demo-v2');
    libraryStore.resetBooks();
    onChanged();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity History</h1>
          <p className="mt-1 text-sm text-gray-500">
            A log of every request, approval, action, and verification result.
          </p>
        </div>
        {activity.length > 0 && (
          <button
            onClick={clearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset Demo Data
          </button>
        )}
      </div>

      {activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <History className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">No activity recorded yet</p>
          <p className="text-xs text-gray-400">
            Renew a book, place a hold, or run a demo scenario to see entries here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {activity.map((a) => {
              const cfg = resultConfig[a.result];
              const Icon = cfg.icon;
              return (
                <li key={a.id} className="flex items-start gap-3 p-4 hover:bg-gray-50">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.tint}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{actionLabel[a.action]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.tint.replace('text-', 'bg-').replace('600', '100')} ${cfg.tint}`}>
                        {cfg.label}
                      </span>
                      {a.verified && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </span>
                      )}
                      {a.source === 'koha' ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600 ring-1 ring-sky-200">
                          LIVE KOHA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          DEMO
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{a.detail}</p>
                    {a.bookTitle && <p className="text-xs text-gray-400">Book: {a.bookTitle}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(a.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
