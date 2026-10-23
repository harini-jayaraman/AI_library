import type { Book, LibraryPolicy } from './types';

export interface RenewalCheck {
  eligible: boolean;
  reason?: string;
  newDueDate?: string;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T09:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function checkRenewal(book: Book, policy: LibraryPolicy): RenewalCheck {
  if (policy.reservationBlocksRenewal && book.status === 'reserved') {
    const ret = book.expectedReturnDate
      ? formatDate(book.expectedReturnDate)
      : 'an unknown date';
    return {
      eligible: false,
      reason: `"${book.title}" has been reserved by ${book.reservedBy}. Library policy prohibits renewal while another user holds a reservation. Expected return: ${ret}.`,
    };
  }

  if (book.renewalsUsed >= book.maxRenewals || book.status === 'limit_reached') {
    return {
      eligible: false,
      reason: `Renewal limit reached for "${book.title}" — ${book.renewalsUsed} of ${book.maxRenewals} renewals used. Policy does not allow further renewals.`,
    };
  }

  if (book.status === 'overdue') {
    return {
      eligible: false,
      reason: `"${book.title}" is overdue. Please return it or contact the circulation desk.`,
    };
  }

  return {
    eligible: true,
    newDueDate: addDays(book.dueDate, policy.renewalPeriodDays),
  };
}

export function estimateFine(book: Book, policy: LibraryPolicy): number | null {
  if (policy.finePerDay === null) return null;
  const due = new Date(book.dueDate + 'T09:00:00').getTime();
  const now = Date.now();
  const overdueMs = now - due;
  if (overdueMs <= 0) return 0;
  const overdueDays = Math.floor(overdueMs / 86400000) - policy.fineGraceDays;
  if (overdueDays <= 0) return 0;
  return overdueDays * policy.finePerDay;
}

export function daysUntil(iso: string): number {
  const target = new Date(iso + 'T09:00:00').getTime();
  const now = Date.now();
  return Math.ceil((target - now) / 86400000);
}

export function isDueSoon(book: Book, policy: LibraryPolicy): boolean {
  const d = daysUntil(book.dueDate);
  return d >= 0 && d <= policy.dueSoonWindowDays;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso + 'T09:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
