import { Menu, Bell } from 'lucide-react';
import { DEMO_USER } from '@/lib/sampleData';

export default function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
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
          className="relative rounded-md p-2 text-gray-600 hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-navy-700 text-sm font-semibold text-white">
            {DEMO_USER.initials}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-gray-800">{DEMO_USER.name}</p>
            <p className="text-xs text-gray-500">{DEMO_USER.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
