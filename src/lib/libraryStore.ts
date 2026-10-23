import type { Book, Hold, ActivityEntry, LibraryPolicy, DashboardStats, DataSource } from './types';
import { borrowedBooks, catalogueBooks, initialHolds, DEFAULT_POLICY } from './sampleData';
import { checkRenewal, isDueSoon, estimateFine, daysUntil } from './policy';
import { notificationStore } from './notificationStore';

const STORAGE_KEY = 'ai-library-demo-v2';

interface StoreState {
  books: Book[];
  holds: Hold[];
  activity: ActivityEntry[];
  policy: LibraryPolicy;
}

function freshState(): StoreState {
  return {
    books: [...borrowedBooks(), ...catalogueBooks()],
    holds: initialHolds(),
    activity: [],
    policy: { ...DEFAULT_POLICY },
  };
}

function load(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as StoreState;
    if (!parsed.books || !parsed.policy) return freshState();
    if (parsed.policy.maxRenewals !== DEFAULT_POLICY.maxRenewals) return freshState();
    return parsed;
  } catch {
    return freshState();
  }
}

function save(state: StoreState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

/**
 * LibraryStore — singleton over localStorage. All mutations go through here
 * so the activity log stays consistent and the UI can subscribe to changes.
 */
class LibraryStore {
  private state: StoreState = load();
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    save(this.state);
    this.listeners.forEach((fn) => fn());
  }

  getBorrowedBooks(): Book[] {
    return this.state.books.filter((b) => !b.inCatalogueOnly);
  }

  getAllBooks(): Book[] {
    return [...this.state.books];
  }

  getBook(id: string): Book | undefined {
    return this.state.books.find((b) => b.id === id);
  }

  getHolds(): Hold[] {
    return [...this.state.holds];
  }

  getActivity(): ActivityEntry[] {
    return [...this.state.activity].sort((a, b) => b.timestamp - a.timestamp);
  }

  getPolicy(): LibraryPolicy {
    return { ...this.state.policy };
  }

  getStats(): DashboardStats {
    const borrowed = this.getBorrowedBooks();
    return {
      totalBorrowed: borrowed.length,
      dueSoon: borrowed.filter((b) => isDueSoon(b, this.state.policy)).length,
      activeHolds: this.state.holds.length,
      completedActions: this.state.activity.filter(
        (a) => a.result === 'success' && a.verified,
      ).length,
    };
  }

  searchBooks(query: string): Book[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const results: Book[] = [];
    for (const b of this.state.books) {
      if (seen.has(b.id)) continue;
      if (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.isbn ?? '').toLowerCase().includes(q) ||
        b.edition.toLowerCase().includes(q)
      ) {
        seen.add(b.id);
        results.push(b);
      }
    }
    return results;
  }

  checkRenewal(bookId: string) {
    const book = this.getBook(bookId);
    if (!book) return { eligible: false, reason: 'Book not found.' };
    return checkRenewal(book, this.state.policy);
  }

  renew(bookId: string): { success: boolean; message: string; newDueDate?: string } {
    const book = this.getBook(bookId);
    if (!book) return { success: false, message: 'Book not found.' };
    const check = checkRenewal(book, this.state.policy);
    if (!check.eligible) {
      this.logActivity({
        action: 'renew_blocked',
        bookTitle: book.title,
        detail: check.reason ?? 'Renewal blocked by policy.',
        result: 'failed',
        verified: true,
        source: 'demo',
      });
      if (book.status === 'reserved') {
        notificationStore.add(
          'Renewal blocked — book reserved',
          `"${book.title}" could not be renewed because ${book.reservedBy ?? 'another user'} has reserved it.`,
          'reservation',
        );
      }
      return { success: false, message: check.reason ?? 'Renewal not permitted.' };
    }
    book.renewalsUsed += 1;
    book.dueDate = check.newDueDate!;
    if (book.renewalsUsed >= book.maxRenewals) book.status = 'limit_reached';

    // Verify the save actually happened
    const verified = this.getBook(bookId)?.dueDate === check.newDueDate;
    this.logActivity({
      action: 'renew',
      bookTitle: book.title,
      detail: `Renewed. New due date: ${check.newDueDate}. Verified: ${verified}.`,
      result: 'success',
      verified,
      source: 'demo',
    });
    notificationStore.add(
      'Book renewed (demo)',
      `"${book.title}" was renewed. New due date: ${check.newDueDate}. Renewals used: ${book.renewalsUsed}/${book.maxRenewals}.`,
      'renewal',
    );
    if (book.renewalsUsed >= book.maxRenewals) {
      notificationStore.add(
        'Renewal limit reached',
        `You have reached the maximum of ${book.maxRenewals} renewals for "${book.title}". No further renewals are permitted.`,
        'limit_reached',
      );
    }
    this.emit();
    return {
      success: true,
      message: `Renewed "${book.title}". New due date: ${check.newDueDate}.`,
      newDueDate: check.newDueDate,
    };
  }

  reserve(bookId: string): { success: boolean; message: string } {
    const book = this.getBook(bookId);
    if (!book) return { success: false, message: 'Book not found.' };
    const queuePos = Math.floor(Math.random() * 3) + 2;
    const hold: Hold = {
      id: `h${Date.now()}`,
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      edition: book.edition,
      placedOn: new Date().toISOString().slice(0, 10),
      status: 'queued',
      queuePosition: queuePos,
    };
    this.state.holds.push(hold);
    const verified = this.state.holds.some((h) => h.id === hold.id);
    this.logActivity({
      action: 'reserve',
      bookTitle: book.title,
      detail: `Reserved. Queue position #${queuePos}. Verified: ${verified}.`,
      result: 'success',
      verified,
      source: 'demo',
    });
    notificationStore.add(
      'Hold placed',
      `You placed a hold on "${book.title}". You are #${queuePos} in the queue.`,
      'hold',
    );
    this.emit();
    return {
      success: true,
      message: `Reserved "${book.title}". You are #${queuePos} in the queue.`,
    };
  }

  logActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>) {
    this.state.activity.push({
      ...entry,
      id: `a${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    });
    // Don't emit here — caller decides (renew/reserve emit after logging).
  }

  logQuery(detail: string) {
    this.logActivity({
      action: 'query',
      detail,
      result: 'info',
      verified: false,
      source: 'demo',
    });
    this.emit();
  }

  logCancelled(bookTitle: string, detail: string) {
    this.logActivity({
      action: 'cancelled',
      bookTitle,
      detail,
      result: 'rejected',
      verified: false,
      source: 'demo',
    });
    this.emit();
  }

  logSearch(query: string, resultCount: number, source: DataSource) {
    this.logActivity({
      action: 'search',
      detail: `Searched "${query}" — ${resultCount} results from ${source === 'koha' ? 'LIVE KOHA DATA' : 'DEMO DATA'}.`,
      result: 'info',
      verified: source === 'koha',
      source,
    });
    this.emit();
  }

  logSearchError(query: string, errorMsg: string) {
    this.logActivity({
      action: 'search',
      detail: `Koha search for "${query}" failed: ${errorMsg}`,
      result: 'failed',
      verified: false,
      source: 'koha',
    });
    this.emit();
  }

  resetAll() {
    this.state = freshState();
    this.emit();
  }

  // Reset only the book/hold data but keep activity log (for scenario resets)
  resetBooks() {
    this.state.books = [...borrowedBooks(), ...catalogueBooks()];
    this.state.holds = initialHolds();
    this.emit();
  }

  getFineEstimate(bookId: string): number | null {
    const book = this.getBook(bookId);
    if (!book) return null;
    return estimateFine(book, this.state.policy);
  }

  checkDueDateNotifications() {
    const borrowed = this.getBorrowedBooks();
    for (const book of borrowed) {
      const d = daysUntil(book.dueDate);
      if (d >= 0 && d <= this.state.policy.dueSoonWindowDays) {
        notificationStore.add(
          'Due date approaching',
          `"${book.title}" is due ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`} (${book.dueDate}). Please renew or return it soon.`,
          'due_date',
        );
      }
    }
  }
}

export const libraryStore = new LibraryStore();
