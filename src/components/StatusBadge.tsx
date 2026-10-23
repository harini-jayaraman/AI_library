import type { RenewalStatus } from '@/lib/types';

const config: Record<RenewalStatus, { label: string; classes: string }> = {
  eligible: {
    label: 'Eligible',
    classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  reserved: {
    label: 'On Hold',
    classes: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  limit_reached: {
    label: 'Limit Reached',
    classes: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  overdue: {
    label: 'Action Required',
    classes: 'bg-red-100 text-red-800 border-red-200',
  },
};

export default function StatusBadge({ status }: { status: RenewalStatus }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.classes}`}>
      {c.label}
    </span>
  );
}
