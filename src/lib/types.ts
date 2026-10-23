export type RenewalStatus = 'eligible' | 'reserved' | 'limit_reached' | 'overdue';
export type DataSource = 'demo' | 'koha';
export type SearchMode = 'live' | 'demo';

export interface Book {
  id: string;
  title: string;
  author: string;
  edition: string;
  isbn?: string;
  coverColor: string; // tailwind gradient
  issueDate: string; // ISO date
  dueDate: string; // ISO date
  renewalsUsed: number;
  maxRenewals: number;
  status: RenewalStatus;
  reservedBy?: string;
  expectedReturnDate?: string; // ISO date when reserved copy expected back
  // Reservation support: catalogue-only books can be reserved.
  inCatalogueOnly?: boolean;
}

export interface Hold {
  id: string;
  bookId?: string;
  bookTitle: string;
  author: string;
  edition: string;
  placedOn: string;
  status: 'queued' | 'ready' | 'in_transit';
  queuePosition: number;
  estimatedAvailable?: string;
}

export interface ActivityEntry {
  id: string;
  action: 'renew' | 'reserve' | 'renew_blocked' | 'reserve_blocked' | 'cancelled' | 'query' | 'search';
  bookTitle?: string;
  detail: string;
  result: 'success' | 'rejected' | 'failed' | 'info';
  verified: boolean;
  timestamp: number;
  source?: DataSource; // 'demo' for simulated, 'koha' for live Koha data
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  action?: ChatAction;
  spoken?: boolean;
}

export type ChatActionKind =
  | 'confirm_renewal'
  | 'confirm_reservation'
  | 'confirm_renew_all'
  | 'choose_book'
  | 'none';

export interface KohaBook {
  biblio_id: number;
  title: string;
  author: string;
  publication_year: string | null;
  isbn: string | null;
  edition: string | null;
  item_type: string | null;
}

export interface ChatAction {
  kind: ChatActionKind;
  options?: string[]; // for choose_book
  bookIds?: string[]; // for confirm_renew_all
  bookId?: string; // for confirm_renewal / confirm_reservation
  confirmLabel?: string;
  verb?: 'renew' | 'reserve'; // for choose_book context
}

export interface DashboardStats {
  totalBorrowed: number;
  dueSoon: number;
  activeHolds: number;
  completedActions: number;
}

export interface LibraryPolicy {
  maxRenewals: number;
  renewalPeriodDays: number;
  reservationBlocksRenewal: boolean;
  finePerDay: number | null; // null = not configured
  fineGraceDays: number;
  dueSoonWindowDays: number;
}

export type ScenarioId = 'due-tomorrow' | 'reserved' | 'ambiguous' | 'limit-reached';

export interface ScenarioResult {
  steps: { label: string; pass: boolean; detail: string }[];
  passed: boolean;
}
