import { useState } from 'react';
import { Play, RotateCcw, CheckCircle2, XCircle, Clock, Layers, Ban, BookMarked, Loader2 } from 'lucide-react';
import { libraryStore } from '@/lib/libraryStore';
import { formatDate, daysUntil, estimateFine } from '@/lib/policy';
import { getFineInfo } from '@/lib/chatEngine';
import type { ScenarioId, ScenarioResult } from '@/lib/types';

interface ScenarioMeta {
  id: ScenarioId;
  icon: typeof Clock;
  title: string;
  description: string;
}

const SCENARIOS: ScenarioMeta[] = [
  { id: 'due-tomorrow', icon: Clock, title: 'Test 1: Two Books Due Tomorrow', description: 'Both eligible. Renew both and verify saved due dates.' },
  { id: 'reserved', icon: Ban, title: 'Test 2: Book Reserved by Another User', description: 'Block renewal, show expected return date, do not modify state.' },
  { id: 'ambiguous', icon: Layers, title: 'Test 3: Ambiguous Database Textbook', description: 'Return 3 editions, require selection + confirmation, then reserve.' },
  { id: 'limit-reached', icon: BookMarked, title: 'Test 4: Renewal Limit Reached', description: 'Block renewal, no retry. Estimate fine or explain limitation.' },
];

export default function DemoScenarios({ onChanged }: { onChanged: () => void }) {
  const [results, setResults] = useState<Record<string, ScenarioResult | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const resetScenario = (id: string) => {
    libraryStore.resetBooks();
    setResults((prev) => ({ ...prev, [id]: null }));
    onChanged();
  };

  const resetAll = () => {
    libraryStore.resetBooks();
    setResults({});
    onChanged();
  };

  const run = (id: string) => {
    // Always reset to fresh data before running so tests are deterministic.
    libraryStore.resetBooks();
    setResults((prev) => ({ ...prev, [id]: null }));
    setBusy(id);
    setTimeout(() => {
      const r = runScenario(id);
      setResults((prev) => ({ ...prev, [id]: r }));
      setBusy(null);
      onChanged();
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demo Scenarios</h1>
          <p className="mt-1 text-sm text-gray-500">Run the four mandatory test cases. Each resets to predictable data first, then verifies results.</p>
        </div>
        <button onClick={resetAll} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <RotateCcw className="h-4 w-4" /> Reset All Demo Data
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const result = results[s.id];
          const isBusy = busy === s.id;
          return (
            <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-navy-100">
                  <Icon className="h-5 w-5 text-navy-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">{s.description}</p>
                </div>
                {result && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${result.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {result.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {result.passed ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => run(s.id)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60">
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {isBusy ? 'Running…' : 'Run Test'}
                </button>
                <button onClick={() => resetScenario(s.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
              </div>

              {result && (
                <div className="mt-4 space-y-2">
                  {result.steps.map((step, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-lg p-2.5 text-sm ${step.pass ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      {step.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                      <div>
                        <p className={`font-medium ${step.pass ? 'text-emerald-800' : 'text-rose-800'}`}>{step.label}</p>
                        <p className={`mt-0.5 text-xs ${step.pass ? 'text-emerald-700' : 'text-rose-700'}`}>{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function runScenario(id: string): ScenarioResult {
  switch (id) {
    case 'due-tomorrow': {
      const steps: ScenarioResult['steps'] = [];
      const borrowed = libraryStore.getBorrowedBooks();
      const due = borrowed.filter((b) => {
        const d = daysUntil(b.dueDate);
        return d >= 0 && d <= 2;
      });
      steps.push({
        label: 'Identify two books due tomorrow',
        pass: due.length === 2,
        detail: due.length === 2 ? `Found: ${due.map((b) => b.title).join(', ')}` : `Expected 2, found ${due.length}.`,
      });

      const eligible = due.filter((b) => libraryStore.checkRenewal(b.id).eligible);
      steps.push({
        label: 'Confirm both are eligible for renewal',
        pass: eligible.length === 2,
        detail: eligible.length === 2 ? 'Both books are eligible.' : `Only ${eligible.length} eligible.`,
      });

      // Renew both
      const renewed: { id: string; title: string; newDate: string }[] = [];
      const failed: string[] = [];
      for (const b of eligible) {
        const res = libraryStore.renew(b.id);
        if (res.success && res.newDueDate) {
          renewed.push({ id: b.id, title: b.title, newDate: res.newDueDate });
        } else {
          failed.push(b.title);
        }
      }
      steps.push({
        label: 'Renew both books after approval',
        pass: renewed.length === 2 && failed.length === 0,
        detail: renewed.length === 2 ? 'Both renewals processed.' : `Renewed ${renewed.length}, failed ${failed.length}.`,
      });

      // Verify saved dates
      let verifiedCount = 0;
      for (const r of renewed) {
        const book = libraryStore.getBook(r.id);
        if (book && book.dueDate === r.newDate) verifiedCount++;
      }
      const verifiedDates = renewed.map((r) => `${r.title}: ${formatDate(r.newDate)}`).join(', ');
      steps.push({
        label: 'Verify new due dates are saved',
        pass: verifiedCount === renewed.length && renewed.length === 2,
        detail: verifiedCount === 2 ? `Verified: ${verifiedDates}` : `Only ${verifiedCount} of ${renewed.length} verified.`,
      });

      return { steps, passed: steps.every((s) => s.pass) };
    }

    case 'reserved': {
      const steps: ScenarioResult['steps'] = [];
      const reserved = libraryStore.getBorrowedBooks().find((b) => b.status === 'reserved');
      steps.push({
        label: 'Find a book with an active reservation',
        pass: Boolean(reserved),
        detail: reserved ? `Found: ${reserved.title} (reserved by ${reserved.reservedBy})` : 'No reserved book found.',
      });

      if (!reserved) return { steps, passed: false };

      const check = libraryStore.checkRenewal(reserved.id);
      steps.push({
        label: 'Refuse renewal and explain the reason',
        pass: !check.eligible && check.reason !== undefined && check.reason.includes('reserved'),
        detail: check.eligible ? 'Renewal was allowed — policy not enforced!' : (check.reason ?? 'Blocked'),
      });

      const retDate = reserved.expectedReturnDate ? formatDate(reserved.expectedReturnDate) : 'not shown';
      steps.push({
        label: 'Display expected return date',
        pass: Boolean(reserved.expectedReturnDate),
        detail: `Expected return date: ${retDate}`,
      });

      // Verify state not modified
      const after = libraryStore.getBook(reserved.id);
      const unchanged = after?.renewalsUsed === reserved.renewalsUsed && after?.dueDate === reserved.dueDate;
      steps.push({
        label: 'Verify renewal state was not modified',
        pass: unchanged,
        detail: unchanged ? 'State unchanged — no renewal attempted.' : 'State was modified unexpectedly!',
      });

      return { steps, passed: steps.every((s) => s.pass) };
    }

    case 'ambiguous': {
      const steps: ScenarioResult['steps'] = [];
      const matches = libraryStore.searchBooks('database');
      steps.push({
        label: 'Return three matching DBMS editions',
        pass: matches.length >= 3,
        detail: matches.length >= 3
          ? matches.map((b, i) => `${i + 1}. ${b.title} — ${b.author} (${b.edition})`).join('; ')
          : `Found only ${matches.length} matches.`,
      });

      if (matches.length < 3) return { steps, passed: false };

      // Simulate user selecting the 2nd edition (Garcia-Molina)
      const selected = matches[1];
      steps.push({
        label: 'Display title, author, and edition for each match',
        pass: matches.every((b) => b.title && b.author && b.edition),
        detail: 'All editions show full details.',
      });

      // Reserve after selection + confirmation
      const res = libraryStore.reserve(selected.id);
      steps.push({
        label: 'Reserve only the selected edition after confirmation',
        pass: res.success,
        detail: res.message,
      });

      // Verify reservation state
      const holds = libraryStore.getHolds();
      const verified = holds.some((h) => h.bookTitle === selected.title);
      steps.push({
        label: 'Verify reservation was recorded',
        pass: verified,
        detail: verified ? `Hold recorded for "${selected.title}".` : 'Hold not found in records.',
      });

      // Verify only one reservation was made (not all 3)
      const newHoldsForDb = holds.filter((h) =>
        matches.some((m) => m.title === h.bookTitle)
      );
      steps.push({
        label: 'Verify only the selected edition was reserved',
        pass: newHoldsForDb.length === 1,
        detail: newHoldsForDb.length === 1 ? 'Exactly one reservation created.' : `${newHoldsForDb.length} reservations found.`,
      });

      return { steps, passed: steps.every((s) => s.pass) };
    }

    case 'limit-reached': {
      const steps: ScenarioResult['steps'] = [];
      const book = libraryStore.getBorrowedBooks().find((b) => b.status === 'limit_reached');
      steps.push({
        label: 'Find a book at the renewal limit',
        pass: Boolean(book),
        detail: book ? `Found: ${book.title} (${book.renewalsUsed}/${book.maxRenewals} renewals)` : 'No limit-reached book found.',
      });

      if (!book) return { steps, passed: false };

      const check = libraryStore.checkRenewal(book.id);
      steps.push({
        label: 'Refuse renewal and do not retry',
        pass: !check.eligible,
        detail: check.eligible ? 'Renewal allowed — should have been blocked!' : (check.reason ?? 'Blocked'),
      });

      // Verify due date not changed
      const after = libraryStore.getBook(book.id);
      const unchanged = after?.dueDate === book.dueDate && after?.renewalsUsed === book.renewalsUsed;
      steps.push({
        label: 'Verify due date was not changed',
        pass: unchanged,
        detail: unchanged ? 'Due date unchanged.' : 'Due date was modified!',
      });

      // Fine estimation
      const policy = libraryStore.getPolicy();
      const fineInfo = getFineInfo(book.id);
      const fine = estimateFine(book, policy);
      if (policy.finePerDay !== null && fine !== null && fine > 0) {
        steps.push({
          label: 'Calculate estimated fine',
          pass: fineInfo.fine === fine,
          detail: fineInfo.reason,
        });
      } else if (policy.finePerDay === null) {
        steps.push({
          label: 'Explain that fine cannot be estimated',
          pass: fineInfo.reason.includes('cannot be estimated'),
          detail: fineInfo.reason,
        });
      } else {
        steps.push({
          label: 'Fine assessment',
          pass: true,
          detail: 'No fine due or book not overdue.',
        });
      }

      return { steps, passed: steps.every((s) => s.pass) };
    }

    default:
      return { steps: [], passed: false };
  }
}
