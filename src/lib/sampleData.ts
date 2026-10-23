import type { Book, LibraryPolicy } from './types';

// Fixed reference "today" so demo scenarios reproduce deterministically.
// We anchor dates relative to the real current date at runtime instead, so
// "due tomorrow" always means tomorrow whenever the app is opened.
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_POLICY: LibraryPolicy = {
  maxRenewals: 10,
  renewalPeriodDays: 14,
  reservationBlocksRenewal: true,
  finePerDay: 5, // ₹5/day — configured so Test 4 can calculate
  fineGraceDays: 0,
  dueSoonWindowDays: 2,
};

// Borrowed books (on Siya Mehra's account)
export function borrowedBooks(): Book[] {
  return [
    {
      id: 'b1',
      title: 'Introduction to Algorithms',
      author: 'Cormen, Leiserson, Rivest, Stein',
      edition: '3rd Edition',
      isbn: '978-0262033848',
      coverColor: 'from-emerald-500 to-teal-700',
      issueDate: daysFromNow(-14),
      dueDate: daysFromNow(1), // due tomorrow — Test 1
      renewalsUsed: 0,
      maxRenewals: DEFAULT_POLICY.maxRenewals,
      status: 'eligible',
    },
    {
      id: 'b2',
      title: 'Operating System Concepts',
      author: 'Silberschatz, Galvin, Gagne',
      edition: '10th Edition',
      isbn: '978-1119320913',
      coverColor: 'from-sky-500 to-blue-700',
      issueDate: daysFromNow(-20),
      dueDate: daysFromNow(1), // due tomorrow — Test 1
      renewalsUsed: 1,
      maxRenewals: DEFAULT_POLICY.maxRenewals,
      status: 'eligible',
    },
    {
      id: 'b3',
      title: 'Database System Concepts',
      author: 'Silberschatz, Korth, Sudarshan',
      edition: '7th Edition',
      isbn: '978-0078022159',
      coverColor: 'from-indigo-500 to-violet-700',
      issueDate: daysFromNow(-10),
      dueDate: daysFromNow(7),
      renewalsUsed: 0,
      maxRenewals: DEFAULT_POLICY.maxRenewals,
      status: 'reserved', // Test 2
      reservedBy: 'Aisha Khan',
      expectedReturnDate: daysFromNow(7),
    },
    {
      id: 'b4',
      title: 'Computer Networks',
      author: 'Tanenbaum, Wetherall',
      edition: '6th Edition',
      isbn: '978-9332587501',
      coverColor: 'from-rose-500 to-red-700',
      issueDate: daysFromNow(-30),
      dueDate: daysFromNow(-2), // overdue — Test 4 (limit reached + overdue)
      renewalsUsed: 10,
      maxRenewals: DEFAULT_POLICY.maxRenewals,
      status: 'limit_reached',
    },
    {
      id: 'b5',
      title: 'Artificial Intelligence: A Modern Approach',
      author: 'Russell, Norvig',
      edition: '4th Edition',
      isbn: '978-0134610993',
      coverColor: 'from-amber-500 to-orange-700',
      issueDate: daysFromNow(-7),
      dueDate: daysFromNow(8),
      renewalsUsed: 0,
      maxRenewals: DEFAULT_POLICY.maxRenewals,
      status: 'eligible',
    },
  ];
}

// Extra DBMS editions available in the catalogue for reservation (Test 3).
// b3 (Database System Concepts) is already borrowed + reserved; the other two
// are catalogue-only and can be reserved.
export function catalogueBooks(): Book[] {
  return [
    {
      id: 'b6',
      title: 'Database Systems: The Complete Book',
      author: 'Garcia-Molina, Ullman, Widom',
      edition: '2nd Edition',
      isbn: '978-0131873254',
      coverColor: 'from-cyan-500 to-teal-700',
      issueDate: '',
      dueDate: '',
      renewalsUsed: 0,
      maxRenewals: DEFAULT_POLICY.maxRenewals,
      status: 'eligible',
      inCatalogueOnly: true,
    },
    {
      id: 'b7',
      title: 'Fundamentals of Database Systems',
      author: 'Elmasri, Navathe',
      edition: '7th Edition',
      isbn: '978-0133970777',
      coverColor: 'from-fuchsia-500 to-pink-700',
      issueDate: '',
      dueDate: '',
      renewalsUsed: 0,
      maxRenewals: DEFAULT_POLICY.maxRenewals,
      status: 'eligible',
      inCatalogueOnly: true,
    },
  ];
}

export function initialHolds() {
  return [
    {
      id: 'h1',
      bookTitle: 'Engineering Mathematics',
      author: 'K.A. Stroud',
      edition: '8th Edition',
      placedOn: daysFromNow(-4),
      status: 'ready' as const,
      queuePosition: 1,
      estimatedAvailable: daysFromNow(0),
    },
  ];
}

export const DEMO_USER = {
  name: 'Siya Mehra',
  initials: 'SM',
  role: 'Student · Computer Science',
};
