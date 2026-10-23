import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, BellOff, Clock, RefreshCw, BookOpen, Ban, AlertTriangle, Sparkles } from 'lucide-react';
import { notificationStore } from '@/lib/notificationStore';
import type { NotificationItem, NotificationFilter } from '@/lib/notificationStore';

const categoryConfig: Record<NotificationItem['category'], { icon: typeof Bell; color: string; bg: string }> = {
  due_date: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  renewal: { icon: RefreshCw, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  reservation: { icon: Ban, color: 'text-rose-600', bg: 'bg-rose-50' },
  limit_reached: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
  hold: { icon: Sparkles, color: 'text-navy-600', bg: 'bg-navy-50' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Notifications() {
  const [, setTick] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => notificationStore.subscribe(refresh), [refresh]);

  const all = notificationStore.getNotifications();
  const unreadCount = notificationStore.getUnreadCount();

  const filtered = all.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const handleMarkAsRead = async (id: string) => {
    await notificationStore.markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    setBusy(true);
    await notificationStore.markAllAsRead();
    setBusy(false);
  };

  const handleClearAll = async () => {
    setBusy(true);
    await notificationStore.clearAll();
    setBusy(false);
  };

  const filters: { id: NotificationFilter; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: all.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'read', label: 'Read' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'You are all caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMarkAllAsRead}
            disabled={busy || unreadCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
          <button
            onClick={handleClearAll}
            disabled={busy || all.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.id
                ? 'bg-navy-700 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${filter === f.id ? 'bg-white/20' : 'bg-gray-100'}`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <BellOff className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">
            {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
          </p>
          <p className="text-xs text-gray-400">
            Notifications will appear here when books are due, renewed, or reserved.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const cfg = categoryConfig[n.category] ?? categoryConfig.renewal;
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  n.read ? 'border-gray-200' : 'border-navy-200 ring-1 ring-navy-100'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${n.read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>
                      {n.title}
                    </p>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-navy-500" />}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">{n.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => handleMarkAsRead(n.id)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
