import type { Book, ChatAction } from './types';
import { libraryStore } from './libraryStore';
import { formatDate, isDueSoon, daysUntil, estimateFine } from './policy';

export interface ParsedIntent {
  type:
    | 'renew_all'
    | 'renew_book'
    | 'renew_due_soon'
    | 'reserve_book'
    | 'due_soon'
    | 'show_books'
    | 'policy_question'
    | 'help'
    | 'search_book'
    | 'unknown';
  bookQuery?: string;
}

const RENEW_ALL_PATTERNS = [
  /\brenew (all|my books|my library|everything|my library books)\b/i,
  /^renew (my )?(books?|library)$/i,
];

const RENEW_DUE_SOON_PATTERNS = [
  /renew (?:the )?books? due (?:tomorrow|soon|today)/i,
  /renew (?:my )?due (?:books|items)/i,
];

const RENEW_BOOK_PATTERNS = [
  /renew (?:my )?(?:copy of )?[""']?(.+?)[""']?(?:\s*(?:book|textbook|edition))?\.?$/i,
];

const RESERVE_PATTERNS = [
  /(?:reserve|hold|request|put (?:a )?hold on)\s+(?:the\s+)?(.+)/i,
];

const DUE_SOON_PATTERNS = [
  /(?:which|what) books? (?:are )?due (?:tomorrow|soon|today)/i,
  /books? due (?:tomorrow|soon|today)/i,
  /due (?:tomorrow|soon|today)/i,
];

const SHOW_BOOKS_PATTERNS = [
  /(?:show|list|display|see) (?:my )?(?:current )?(?:borrowed )?books?/i,
  /what (?:books|items) (?:do|have) i (?:have|borrowed)/i,
  /my (?:borrowed )?books?/i,
];

const POLICY_PATTERNS = [
  /can i renew (?:this|a|the) book if (?:another|someone) (?:user|student) (?:has )?reserved/i,
  /renew.*reserved/i,
  /what.*policy/i,
  /renewal (?:rules?|policy|limit)/i,
  /fine/i,
];

const HELP_PATTERNS = [/\bhelp\b/i, /\bwhat can you do\b/i, /\bhow (?:do|can) i\b/i];

const SEARCH_PATTERNS = [
  /search (?:koha |the koha |the )?catalogue (?:for |on )?(.+)/i,
  /search (?:for |the )(.+)/i,
  /find (?:me )?(?:a )?(?:book (?:on|about) )?(.+)/i,
  /look up (.+)/i,
];

export function parseIntent(text: string): ParsedIntent {
  const t = text.trim();

  for (const p of RENEW_DUE_SOON_PATTERNS) if (p.test(t)) return { type: 'renew_due_soon' };
  for (const p of RENEW_ALL_PATTERNS) if (p.test(t)) return { type: 'renew_all' };
  for (const p of DUE_SOON_PATTERNS) if (p.test(t)) return { type: 'due_soon' };
  for (const p of SHOW_BOOKS_PATTERNS) if (p.test(t)) return { type: 'show_books' };
  for (const p of POLICY_PATTERNS) if (p.test(t)) return { type: 'policy_question' };
  for (const p of HELP_PATTERNS) if (p.test(t)) return { type: 'help' };

  const searchMatch = t.match(SEARCH_PATTERNS[0]);
  if (searchMatch) {
    const q = cleanQuery(searchMatch[1]);
    if (q) return { type: 'search_book', bookQuery: q };
  }

  const reserveMatch = t.match(RESERVE_PATTERNS[0]);
  if (reserveMatch) {
    const q = cleanQuery(reserveMatch[1]);
    if (q) return { type: 'reserve_book', bookQuery: q };
  }

  for (const p of RENEW_BOOK_PATTERNS) {
    const m = t.match(p);
    if (m) {
      const q = cleanQuery(m[1]);
      if (q) return { type: 'renew_book', bookQuery: q };
    }
  }

  return { type: 'unknown' };
}

function cleanQuery(raw: string): string {
  return raw
    .trim()
    .replace(/^(my|the|a|an)\s+/i, '')
    .replace(/\s*(?:book|textbook|edition)\s*$/i, '')
    .replace(/[.?!]+$/, '')
    .trim();
}

// Split compound requests ("renew my books and reserve the DBMS textbook")
export function parseCompound(text: string): ParsedIntent[] {
  const parts = text
    .split(/\s+(?:and|then|also|after that)\s+|,\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [parseIntent(text)];
  return parts.map(parseIntent);
}

export interface ChatResult {
  content: string;
  action: ChatAction;
}

export function handleIntent(intent: ParsedIntent): ChatResult {
  const policy = libraryStore.getPolicy();

  switch (intent.type) {
    case 'renew_all':
    case 'renew_due_soon': {
      const borrowed = libraryStore.getBorrowedBooks();
      const candidates =
        intent.type === 'renew_due_soon'
          ? borrowed.filter((b) => isDueSoon(b, policy))
          : borrowed;
      const eligible = candidates.filter((b) => libraryStore.checkRenewal(b.id).eligible);
      if (eligible.length === 0) {
        return {
          content:
            candidates.length === 0
              ? "No books match that criteria."
              : "None of the matching books are eligible for renewal — they're either reserved by another student or have reached the renewal limit. Check the My Books page for details.",
          action: { kind: 'none' },
        };
      }
      const list = eligible.map((b) => `• ${b.title} (due ${formatDate(b.dueDate)})`).join('\n');
      const newDates = eligible
        .map((b) => `${b.title} → ${formatDate(libraryStore.checkRenewal(b.id).newDueDate!)}`)
        .join('\n');
      return {
        content: `I found ${eligible.length} book${eligible.length > 1 ? 's' : ''} eligible for renewal:\n\n${list}\n\nProposed new due dates:\n${newDates}\n\nApprove to renew ${eligible.length > 1 ? 'all of them' : 'it'}.`,
        action: {
          kind: 'confirm_renew_all',
          bookIds: eligible.map((b) => b.id),
          confirmLabel: 'Yes, renew all',
        },
      };
    }

    case 'renew_book': {
      const matches = libraryStore.searchBooks(intent.bookQuery!);
      if (matches.length === 0) {
        return {
          content: `I couldn't find a borrowed book matching "${intent.bookQuery}". Check the title or browse My Books.`,
          action: { kind: 'none' },
        };
      }
      const borrowed = matches.filter((b) => !b.inCatalogueOnly);
      if (borrowed.length === 0) {
        return {
          content: `"${intent.bookQuery}" is in the catalogue but not on your account, so there's nothing to renew. Did you mean to reserve it instead?`,
          action: { kind: 'none' },
        };
      }
      if (borrowed.length === 1) return buildRenewConfirm(borrowed[0]);
      return buildDisambiguation(borrowed, 'renew', intent.bookQuery!);
    }

    case 'reserve_book': {
      const matches = libraryStore.searchBooks(intent.bookQuery!);
      if (matches.length === 0) {
        return {
          content: `I couldn't find any book matching "${intent.bookQuery}" in the catalogue. Try a different title or author.`,
          action: { kind: 'none' },
        };
      }
      if (matches.length === 1) return buildReserveConfirm(matches[0]);
      return buildDisambiguation(matches, 'reserve', intent.bookQuery!);
    }

    case 'due_soon': {
      const borrowed = libraryStore.getBorrowedBooks();
      const due = borrowed.filter((b) => isDueSoon(b, policy));
      if (due.length === 0) {
        return {
          content: 'You have no books due in the next 2 days. You\'re all set!',
          action: { kind: 'none' },
        };
      }
      const list = due
        .map((b) => {
          const check = libraryStore.checkRenewal(b.id);
          const tag = check.eligible ? 'eligible to renew' : 'not eligible';
          return `• ${b.title} — due ${formatDate(b.dueDate)} (${tag})`;
        })
        .join('\n');
      return {
        content: `You have ${due.length} book${due.length > 1 ? 's' : ''} due soon:\n\n${list}\n\nAsk me to renew the eligible ones.`,
        action: { kind: 'none' },
      };
    }

    case 'show_books': {
      const borrowed = libraryStore.getBorrowedBooks();
      if (borrowed.length === 0) {
        return { content: 'You have no borrowed books right now.', action: { kind: 'none' } };
      }
      const list = borrowed
        .map((b) => {
          const d = daysUntil(b.dueDate);
          const dueLabel = d < 0 ? `${Math.abs(d)} days overdue` : `due ${formatDate(b.dueDate)}`;
          return `• ${b.title} — ${b.author} (${b.edition}) — ${dueLabel}`;
        })
        .join('\n');
      return {
        content: `Here are your ${borrowed.length} borrowed book${borrowed.length > 1 ? 's' : ''}:\n\n${list}`,
        action: { kind: 'none' },
      };
    }

    case 'policy_question': {
      const policy = libraryStore.getPolicy();
      return {
        content: `Library renewal policy (demo):\n• Maximum renewals per book: ${policy.maxRenewals}\n• Each renewal extends the due date by ${policy.renewalPeriodDays} days\n• If another student has reserved a book, renewal is ${policy.reservationBlocksRenewal ? 'blocked' : 'allowed'}\n• Late fine: ${policy.finePerDay !== null ? `₹${policy.finePerDay}/day (after ${policy.fineGraceDays} grace days)` : 'not configured'}\n\nSo if another student reserved your book, you cannot renew it until they return it.`,
        action: { kind: 'none' },
      };
    }

    case 'help': {
      return {
        content:
          'I can help you with:\n• "Renew my library books" — renews all eligible books\n• "Renew the books due tomorrow" — renews only due-soon books\n• "Renew <book title>" — renews a specific book\n• "Reserve <book title>" — places a hold\n• "Search for <topic>" — searches the live Koha catalogue\n• "Which books are due tomorrow?" — lists due-soon books\n• "Show my current borrowed books" — lists your books\n• "Can I renew a book if someone reserved it?" — explains the policy\n\nI\'ll always ask for your approval before any action.',
        action: { kind: 'none' },
      };
    }

    case 'search_book': {
      return {
        content: `Use the Catalogue Search page to search the Koha catalogue for "${intent.bookQuery}", or ask me "search for ${intent.bookQuery}" directly.`,
        action: { kind: 'none' },
      };
    }

    default:
      return {
        content:
          'I didn\'t catch that. Try "Renew my library books", "Reserve the DBMS textbook", "Search for algorithms", or "Which books are due tomorrow?"',
        action: { kind: 'none' },
      };
  }
}

function buildDisambiguation(matches: Book[], verb: 'renew' | 'reserve', query: string): ChatResult {
  const list = matches
    .map((b, i) => `${i + 1}. ${b.title} — ${b.author} (${b.edition})`)
    .join('\n');
  return {
    content: `I found ${matches.length} books matching "${query}". Which edition do you mean?\n\n${list}\n\nTap the one you want to ${verb}.`,
    action: {
      kind: 'choose_book',
      options: matches.map((b) => b.id),
      verb,
    },
  };
}

function buildRenewConfirm(book: Book): ChatResult {
  const check = libraryStore.checkRenewal(book.id);
  if (!check.eligible) {
    return {
      content: `I can't renew "${book.title}". ${check.reason}`,
      action: { kind: 'none' },
    };
  }
  return {
    content: `Renew "${book.title}" (currently due ${formatDate(book.dueDate)})? The new due date will be ${formatDate(check.newDueDate!)}. Approve to proceed.`,
    action: {
      kind: 'confirm_renewal',
      bookId: book.id,
      confirmLabel: 'Yes, renew',
    },
  };
}

function buildReserveConfirm(book: Book): ChatResult {
  return {
    content: `Place a hold on "${book.title}" by ${book.author} (${book.edition})? You'll join the reservation queue. Approve to proceed.`,
    action: {
      kind: 'confirm_reservation',
      bookId: book.id,
      confirmLabel: 'Yes, reserve',
    },
  };
}

export function confirmAction(action: ChatAction): ChatResult[] {
  // confirm_renew_all renews multiple books → multiple results
  if (action.kind === 'confirm_renew_all' && action.bookIds) {
    const successLines: string[] = [];
    const failLines: string[] = [];
    for (const id of action.bookIds) {
      const res = libraryStore.renew(id);
      if (res.success) successLines.push(res.message);
      else failLines.push(res.message);
    }
    const parts: string[] = [];
    if (successLines.length) {
      parts.push(`Completed ${successLines.length} renewal${successLines.length > 1 ? 's' : ''}:\n${successLines.map((l) => '• ' + l).join('\n')}`);
    }
    if (failLines.length) {
      parts.push(`Could not renew ${failLines.length} book${failLines.length > 1 ? 's' : ''}:\n${failLines.map((l) => '• ' + l).join('\n')}`);
    }
    parts.push('This was a demo action — no real library account was changed.');
    return [{ content: parts.join('\n\n'), action: { kind: 'none' } }];
  }

  if (action.kind === 'confirm_renewal' && action.bookId) {
    const res = libraryStore.renew(action.bookId);
    return [
      {
        content: res.success
          ? `${res.message} Verified: due date updated to ${res.newDueDate}. This was a demo action — no real library account was changed.`
          : `Renewal failed: ${res.message}`,
        action: { kind: 'none' },
      },
    ];
  }

  if (action.kind === 'confirm_reservation' && action.bookId) {
    const res = libraryStore.reserve(action.bookId);
    return [
      {
        content: res.success
          ? `${res.message} This was a demo action — no real library account was changed.`
          : `Reservation failed: ${res.message}`,
        action: { kind: 'none' },
      },
    ];
  }

  return [{ content: 'Action cancelled.', action: { kind: 'none' } }];
}

export function pickBook(bookId: string, verb: 'renew' | 'reserve'): ChatResult {
  const book = libraryStore.getBook(bookId);
  if (!book) return { content: 'That book is no longer available.', action: { kind: 'none' } };
  if (verb === 'renew') {
    if (book.inCatalogueOnly) {
      return {
        content: `"${book.title}" isn't on your account — it's in the catalogue. Did you mean to reserve it?`,
        action: { kind: 'none' },
      };
    }
    return buildRenewConfirm(book);
  }
  return buildReserveConfirm(book);
}

// Compound handling — process intents in sequence, pause for interaction
export interface CompoundResult {
  content: string;
  action: ChatAction;
  remaining: ParsedIntent[];
}

export function handleCompound(intents: ParsedIntent[]): CompoundResult {
  const parts: string[] = [];
  for (let i = 0; i < intents.length; i++) {
    const res = handleIntent(intents[i]);
    if (
      res.action.kind === 'choose_book' ||
      res.action.kind === 'confirm_renewal' ||
      res.action.kind === 'confirm_reservation' ||
      res.action.kind === 'confirm_renew_all'
    ) {
      const prefix = parts.length ? parts.join('\n\n') + '\n\n' : '';
      return { content: prefix + res.content, action: res.action, remaining: intents.slice(i + 1) };
    }
    parts.push(res.content);
  }
  return { content: parts.join('\n\n'), action: { kind: 'none' }, remaining: [] };
}

export function resumeCompound(remaining: ParsedIntent[], lead: string): CompoundResult {
  const parts: string[] = [lead];
  for (let i = 0; i < remaining.length; i++) {
    const res = handleIntent(remaining[i]);
    if (
      res.action.kind === 'choose_book' ||
      res.action.kind === 'confirm_renewal' ||
      res.action.kind === 'confirm_reservation' ||
      res.action.kind === 'confirm_renew_all'
    ) {
      return { content: parts.join('\n\n'), action: res.action, remaining: remaining.slice(i + 1) };
    }
    parts.push(res.content);
  }
  return { content: parts.join('\n\n'), action: { kind: 'none' }, remaining: [] };
}

// For Test 4 fine display
export function getFineInfo(bookId: string): { fine: number | null; reason: string } {
  const book = libraryStore.getBook(bookId);
  const policy = libraryStore.getPolicy();
  if (!book) return { fine: null, reason: 'Book not found.' };
  const fine = estimateFine(book, policy);
  if (policy.finePerDay === null) {
    return { fine: null, reason: 'Fine cannot be estimated — no fine rate is configured in the policy.' };
  }
  if (fine === null || fine === 0) {
    return { fine: 0, reason: 'No fine — the book is not overdue.' };
  }
  const overdueDays = Math.abs(daysUntil(book.dueDate));
  return {
    fine,
    reason: `Estimated fine: ₹${fine} (${overdueDays} days overdue × ₹${policy.finePerDay}/day).`,
  };
}
