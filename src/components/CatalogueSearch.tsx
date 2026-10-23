import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, BookOpen, Wifi, RefreshCw, FlaskConical, CloudOff } from 'lucide-react';
import { searchKohaCatalogue, checkKohaConnection, KohaClientError } from '@/lib/kohaClient';
import type { KohaResult, KohaStatus } from '@/lib/kohaClient';
import { libraryStore } from '@/lib/libraryStore';
import type { SearchMode } from '@/lib/types';

interface Props {
  searchMode: SearchMode;
}

interface DemoResult {
  biblio_id: number;
  title: string;
  author: string;
  publication_year: string | null;
  isbn: string | null;
  edition: string | null;
  item_type: string | null;
}

export default function CatalogueSearch({ searchMode }: Props) {
  const isLive = searchMode === 'live';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KohaResult[] | DemoResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [status, setStatus] = useState<KohaStatus>('unknown');
  const [searched, setSearched] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!isLive) { setStatus('unknown'); return; }
    setStatus('checking');
    const s = await checkKohaConnection();
    setStatus(s);
  }, [isLive]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setHint(null);
    setSearched(true);

    if (!isLive) {
      const demoBooks = libraryStore.searchBooks(q);
      const demoResults: DemoResult[] = demoBooks.map((b) => ({
        biblio_id: 0,
        title: b.title,
        author: b.author,
        publication_year: b.dueDate ? b.dueDate.slice(0, 4) : null,
        isbn: b.isbn ?? null,
        edition: b.edition,
        item_type: 'BK',
      }));
      setResults(demoResults);
      setTotal(demoResults.length);
      libraryStore.logSearch(q, demoResults.length, 'demo');
      setLoading(false);
      return;
    }

    try {
      const res = await searchKohaCatalogue(q);
      setResults(res.results);
      setTotal(res.total);
      setStatus('connected');
      libraryStore.logSearch(q, res.total, 'koha');
    } catch (err) {
      const e = err as KohaClientError;
      setError(e.message);
      setHint(e.hint ?? null);
      setResults([]);
      setTotal(0);
      setStatus('temporarily_unavailable');
      libraryStore.logSearchError(q, e.message);
    }
    setLoading(false);
  }, [isLive]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Catalogue Search</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isLive
            ? 'Search the live Koha demo library at koha-demo.ibict.br.'
            : 'Searching local demo data. Switch to Live Koha mode in the sidebar for real catalogue data.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {isLive ? (
          <>
            {status === 'connected' && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                <Wifi className="h-4 w-4" /> Koha Connected
              </span>
            )}
            {status === 'checking' && (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
              </span>
            )}
            {status === 'temporarily_unavailable' && (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200">
                <CloudOff className="h-4 w-4" /> Koha Temporarily Unavailable
              </span>
            )}
            {status === 'unknown' && (
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-500">
                <CloudOff className="h-4 w-4" /> Not checked
              </span>
            )}
            <button onClick={checkConnection} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <RefreshCw className="h-3.5 w-3.5" /> Recheck
            </button>
            <span className="text-xs text-gray-400">Target: https://koha-demo.ibict.br/api/v1/</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 ring-1 ring-purple-200">
            <FlaskConical className="h-4 w-4" /> Demo Data
          </span>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); doSearch(query); }} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, or keyword…"
          className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
        />
        <button type="submit" disabled={!query.trim() || loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-medium text-rose-800">Search failed</p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              {hint && <p className="mt-2 text-xs text-rose-600">{hint}</p>}
              <p className="mt-3 text-xs text-rose-500">
                The app remains fully functional in DEMO MODE for renewals, holds, and the four test scenarios.
              </p>
            </div>
          </div>
        </div>
      )}

      {searched && !loading && !error && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                LIVE KOHA DATA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 ring-1 ring-purple-200">
                DEMO DATA
              </span>
            )}
            <span className="text-sm text-gray-500">
              {total} result{total !== 1 ? 's' : ''} for "{query}"
            </span>
          </div>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <BookOpen className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-600">No results found</p>
              <p className="text-xs text-gray-400">Try a different search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((b, i) => (
                <div key={`${b.biblio_id}-${i}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-2 shrink-0 rounded bg-gradient-to-b ${isLive ? 'from-sky-500 to-navy-700' : 'from-purple-500 to-navy-700'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{b.title}</p>
                      <p className="text-sm text-gray-500">{b.author}</p>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-gray-600">
                    {b.publication_year && <div><span className="text-gray-400">Published:</span> {b.publication_year}</div>}
                    {b.isbn && <div><span className="text-gray-400">ISBN:</span> {b.isbn}</div>}
                    {b.edition && <div><span className="text-gray-400">Edition:</span> {b.edition}</div>}
                    {b.item_type && <div><span className="text-gray-400">Type:</span> {b.item_type}</div>}
                    {isLive && b.biblio_id > 0 && <div><span className="text-gray-400">Biblio ID:</span> {b.biblio_id}</div>}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Search className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">
            {isLive ? 'Search the Koha catalogue' : 'Search demo data'}
          </p>
          <p className="text-xs text-gray-400">
            {isLive
              ? 'Enter a title, author, or keyword above to search the live library.'
              : 'Enter a title or author above to search the local demo collection.'}
          </p>
        </div>
      )}
    </div>
  );
}
