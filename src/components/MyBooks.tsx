import { useState } from 'react';
import { RefreshCw, BookOpen, CheckCircle2, XCircle, Info } from 'lucide-react';
import type { Book } from '@/lib/types';
import { libraryStore } from '@/lib/libraryStore';
import { formatDate, daysUntil, estimateFine } from '@/lib/policy';
import StatusBadge from './StatusBadge';

interface RenewResult {
  bookId: string;
  success: boolean;
  message: string;
}

export default function MyBooks({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<RenewResult | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<Book | null>(null);
  const [inspectBook, setInspectBook] = useState<Book | null>(null);

  const books = libraryStore.getBorrowedBooks();
  const policy = libraryStore.getPolicy();

  const startRenew = (book: Book) => {
    const check = libraryStore.checkRenewal(book.id);
    if (!check.eligible) {
      setResult({ bookId: book.id, success: false, message: check.reason ?? 'Not eligible.' });
      setPendingConfirm(null);
      return;
    }
    setPendingConfirm(book);
    setResult(null);
  };

  const confirmRenew = () => {
    if (!pendingConfirm) return;
    setBusy(pendingConfirm.id);
    setPendingConfirm(null);
    setTimeout(() => {
      const res = libraryStore.renew(pendingConfirm.id);
      setResult({ bookId: pendingConfirm.id, success: res.success, message: res.message });
      setBusy(null);
      onChanged();
    }, 600);
  };

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
        <BookOpen className="h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-600">No borrowed books</p>
        <p className="text-xs text-gray-400">Books you borrow will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Books</h1>
        <p className="mt-1 text-sm text-gray-500">{books.length} books currently borrowed.</p>
      </div>

      {result && (
        <div className={`flex items-start gap-3 rounded-lg border p-4 ${result.success ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          {result.success ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />}
          <div className="flex-1">
            <p className={`text-sm font-medium ${result.success ? 'text-emerald-800' : 'text-rose-800'}`}>
              {result.success ? 'Renewal successful (demo)' : 'Renewal not permitted'}
            </p>
            <p className={`mt-0.5 text-sm ${result.success ? 'text-emerald-700' : 'text-rose-700'}`}>{result.message}</p>
            <p className="mt-1 text-xs text-gray-500">DEMO MODE — no real library account was changed.</p>
          </div>
          <button onClick={() => setResult(null)} className="text-xs font-medium text-gray-500 hover:text-gray-700">Dismiss</button>
        </div>
      )}

      {pendingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Confirm renewal</h3>
            <p className="mt-2 text-sm text-gray-600">Renew <span className="font-medium text-gray-900">{pendingConfirm.title}</span>?</p>
            <p className="mt-1 text-xs text-gray-500">
              Due {formatDate(pendingConfirm.dueDate)} → new due date {formatDate(libraryStore.checkRenewal(pendingConfirm.id).newDueDate!)}.
            </p>
            <p className="mt-2 text-xs text-gray-400">Renewal {pendingConfirm.renewalsUsed + 1} of {pendingConfirm.maxRenewals}. DEMO MODE.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setPendingConfirm(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={confirmRenew} className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">Yes, renew</button>
            </div>
          </div>
        </div>
      )}

      {inspectBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-2 rounded bg-gradient-to-b ${inspectBook.coverColor}`} />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{inspectBook.title}</h3>
                  <p className="text-xs text-gray-500">{inspectBook.author} · {inspectBook.edition}</p>
                </div>
              </div>
              <StatusBadge status={inspectBook.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-gray-400">Borrow date</dt><dd className="text-gray-700">{formatDate(inspectBook.issueDate)}</dd></div>
              <div><dt className="text-xs text-gray-400">Due date</dt><dd className="text-gray-700">{formatDate(inspectBook.dueDate)}</dd></div>
              <div><dt className="text-xs text-gray-400">Renewals used</dt><dd className="text-gray-700">{inspectBook.renewalsUsed} / {inspectBook.maxRenewals}</dd></div>
              <div><dt className="text-xs text-gray-400">Days until due</dt><dd className="text-gray-700">{daysUntil(inspectBook.dueDate)}</dd></div>
            </dl>
            {inspectBook.status === 'reserved' && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                Reserved by {inspectBook.reservedBy}. Expected return: {formatDate(inspectBook.expectedReturnDate ?? '')}.
                Renewal is blocked by policy.
              </div>
            )}
            {inspectBook.status === 'limit_reached' && (
              <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                Renewal limit reached. {(() => {
                  const fine = estimateFine(inspectBook, policy);
                  if (policy.finePerDay === null) return 'Fine cannot be estimated — no fine rate configured.';
                  if (fine === null || fine === 0) return 'No fine currently due.';
                  return `Estimated fine: ₹${fine} (${Math.abs(daysUntil(inspectBook.dueDate))} days overdue × ₹${policy.finePerDay}/day).`;
                })()}
              </div>
            )}
            <div className="mt-5 flex justify-between gap-2">
              <button onClick={() => setInspectBook(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Close</button>
              <button
                onClick={() => { setInspectBook(null); startRenew(inspectBook); }}
                disabled={!libraryStore.checkRenewal(inspectBook.id).eligible || busy === inspectBook.id}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${libraryStore.checkRenewal(inspectBook.id).eligible ? 'bg-navy-700 text-white hover:bg-navy-800' : 'cursor-not-allowed bg-gray-100 text-gray-400'}`}
              >
                Renew
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Book</th>
              <th className="px-4 py-3 font-medium">Borrowed</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Renewals</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {books.map((b) => {
              const check = libraryStore.checkRenewal(b.id);
              return (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-1.5 rounded bg-gradient-to-b ${b.coverColor}`} />
                      <div>
                        <p className="font-medium text-gray-900">{b.title}</p>
                        <p className="text-xs text-gray-500">{b.author} · {b.edition}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(b.issueDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(b.dueDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{b.renewalsUsed}/{b.maxRenewals}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setInspectBook(b)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        <Info className="h-3.5 w-3.5" /> Inspect
                      </button>
                      <button
                        onClick={() => startRenew(b)}
                        disabled={!check.eligible || busy === b.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${check.eligible ? 'bg-navy-700 text-white hover:bg-navy-800' : 'cursor-not-allowed bg-gray-100 text-gray-400'}`}
                      >
                        {busy === b.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {busy === b.id ? 'Renewing…' : 'Renew'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {books.map((b) => {
          const check = libraryStore.checkRenewal(b.id);
          return (
            <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`h-12 w-2 rounded bg-gradient-to-b ${b.coverColor}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{b.title}</p>
                  <p className="text-xs text-gray-500">{b.author} · {b.edition}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div><span className="text-gray-400">Borrowed:</span> {formatDate(b.issueDate)}</div>
                <div><span className="text-gray-400">Due:</span> {formatDate(b.dueDate)}</div>
                <div><span className="text-gray-400">Renewals:</span> {b.renewalsUsed}/{b.maxRenewals}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setInspectBook(b)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Inspect
                </button>
                <button
                  onClick={() => startRenew(b)}
                  disabled={!check.eligible || busy === b.id}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${check.eligible ? 'bg-navy-700 text-white hover:bg-navy-800' : 'cursor-not-allowed bg-gray-100 text-gray-400'}`}
                >
                  {busy === b.id ? 'Renewing…' : check.eligible ? 'Renew' : 'Not eligible'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
