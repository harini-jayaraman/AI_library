import { useState, useEffect, useCallback } from 'react';
import { Menu, Bell, LogOut, User as UserIcon } from 'lucide-react';
import { DEMO_USER } from '@/lib/sampleData';
import { notificationStore } from '@/lib/notificationStore';
import { useAuth } from '@/lib/authContext';
import type { View } from './Sidebar';

interface Props {
  onOpenMobile: () => void;
  onNavigate: (v: View) => void;
  isDemoMode: boolean;
}

export default function Header({ onOpenMobile, onNavigate, isDemoMode }: Props) {
  const { user, signOut } = useAuth();
  const [, setTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => notificationStore.subscribe(refresh), [refresh]);

  const unreadCount = notificationStore.getUnreadCount();
  const displayName = isDemoMode ? DEMO_USER.name : (user?.email ?? 'User');
  const initials = isDemoMode ? DEMO_USER.initials : (user?.email?.[0]?.toUpperCase() ?? 'U');
  const role = isDemoMode ? DEMO_USER.role : 'Signed in';

  const handleBellClick = () => {
    onNavigate('notifications');
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:px-8">
      <button
        className="rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
        onClick={onOpenMobile}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex flex-1 items-center justify-end gap-3">
        <button
          onClick={handleBellClick}
          className="relative rounded-md p-2 text-gray-600 hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-navy-700 text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium text-gray-800">{displayName}</p>
              <p className="text-xs text-gray-500">{role}</p>
            </div>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-medium text-gray-800">{displayName}</p>
                  <p className="truncate text-xs text-gray-500">{user?.email ?? 'Demo Mode'}</p>
                </div>
                {!isDemoMode && (
                  <button
                    onClick={() => { setMenuOpen(false); onNavigate('notifications'); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    My notifications
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  {isDemoMode ? 'Exit Demo Mode' : 'Sign out'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
