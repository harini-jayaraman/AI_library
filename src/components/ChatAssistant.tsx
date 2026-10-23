import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, User, CheckCircle2, XCircle,
  Mic, MicOff, Volume2, VolumeX, Square, Loader2, Sparkles,
} from 'lucide-react';
import type { ChatMessage, ChatAction, SearchMode } from '@/lib/types';
import {
  parseIntent, parseCompound, handleIntent, handleCompound, resumeCompound,
  confirmAction, pickBook,
} from '@/lib/chatEngine';
import type { ParsedIntent } from '@/lib/chatEngine';
import { libraryStore } from '@/lib/libraryStore';
import { useSpeech } from '@/lib/useSpeech';
import { searchKohaCatalogue, KohaClientError } from '@/lib/kohaClient';

const SUGGESTIONS = [
  'Renew my library books.',
  'Renew the books due tomorrow.',
  'Reserve the DBMS textbook.',
  'Can I renew a book if another student reserved it?',
  'Show my current borrowed books.',
  'Search Koha catalogue for algorithms.',
];

let msgId = 0;
function makeMsg(role: ChatMessage['role'], content: string, action?: ChatAction): ChatMessage {
  return { id: `m${++msgId}`, role, content, timestamp: Date.now(), action };
}

function formatContent(content: string) {
  return content.split('\n').map((line, i) => (
    <span key={i} className="block">{line || '\u00A0'}</span>
  ));
}

export default function ChatAssistant({ onChanged, searchMode, userName }: { onChanged: () => void; searchMode: SearchMode; userName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMsg('assistant', `Hi ${userName || 'there'}! I'm your AI library assistant. I can renew books, place holds, check due dates, and explain renewal policies. Tap the microphone to speak, or type your request below.`),
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pendingAction, setPendingAction] = useState<ChatAction | null>(null);
  const [remainingIntents, setRemainingIntents] = useState<ParsedIntent[]>([]);
  const [lastVerb, setLastVerb] = useState<'renew' | 'reserve' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speech = useSpeech();
  const { sttSupported, listening, speaking, interim, error: speechError, muted, speak, stopSpeaking } = speech;

  const sendRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    speech.setOnFinal((text) => sendRef.current(text));
  }, [speech]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, interim, listening]);

  const spokenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && !last.spoken && !spokenIdsRef.current.has(last.id)) {
      spokenIdsRef.current.add(last.id);
      speak(last.content);
    }
  }, [messages, speak]);

  const pushAssistant = useCallback((content: string, action?: ChatAction) => {
    setMessages((m) => [...m, makeMsg('assistant', content, action)]);
    setPendingAction(action && action.kind !== 'none' ? action : null);
  }, []);

  const resolveConfirm = useCallback(() => {
    if (!pendingAction) return;
    const wasRenewal = pendingAction.kind === 'confirm_renewal' || pendingAction.kind === 'confirm_renew_all';
    const results = confirmAction(pendingAction);
    if (remainingIntents.length > 0) {
      const lead = results[0].content;
      const cont = resumeCompound(remainingIntents, lead);
      pushAssistant(cont.content, cont.action);
      setRemainingIntents(cont.remaining);
    } else {
      results.forEach((r) => pushAssistant(r.content, r.action));
    }
    if (wasRenewal) onChanged();
    setPendingAction(null);
    setThinking(false);
  }, [pendingAction, remainingIntents, pushAssistant, onChanged]);

  const resolvePick = useCallback((bookId: string) => {
    const verb = lastVerb ?? 'reserve';
    const res = pickBook(bookId, verb);
    pushAssistant(res.content, res.action);
    setPendingAction(res.action.kind !== 'none' ? res.action : null);
    setThinking(false);
  }, [lastVerb, pushAssistant]);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setMessages((m) => [...m, makeMsg('user', trimmed)]);
    setInput('');
    setThinking(true);
    libraryStore.logQuery(trimmed);

    setTimeout(() => {
      const affirmative = /^(yes|yep|yeah|confirm|go ahead|do it|sure|please|renew all|approve)\b/i.test(trimmed);
      const negative = /^(no|nope|cancel|never|stop|skip)\b/i.test(trimmed);

      if (pendingAction) {
        if (pendingAction.kind === 'choose_book') {
          const numMatch = trimmed.match(/\d+/);
          if (numMatch) {
            const idx = parseInt(numMatch[0], 10) - 1;
            const opt = pendingAction.options?.[idx];
            if (opt) { resolvePick(opt); return; }
          }
          const match = pendingAction.options
            ?.map((id) => libraryStore.getBook(id))
            .filter((b): b is NonNullable<typeof b> => !!b)
            .find((b) => b.title.toLowerCase().includes(trimmed.toLowerCase()));
          if (match) { resolvePick(match.id); return; }
        } else if (pendingAction.kind === 'confirm_renewal' || pendingAction.kind === 'confirm_reservation' || pendingAction.kind === 'confirm_renew_all') {
          if (affirmative) { resolveConfirm(); return; }
          if (negative) {
            if (remainingIntents.length > 0) {
              const res = resumeCompound(remainingIntents, 'Okay, I skipped that step.');
              pushAssistant(res.content, res.action);
              setRemainingIntents(res.remaining);
            } else {
              pushAssistant('Okay, I cancelled that action. No changes were made. Anything else?');
              libraryStore.logCancelled('', 'User rejected confirmation.');
            }
            setPendingAction(null);
            setThinking(false);
            return;
          }
        }
      }

      // Handle catalogue search (async, bypasses sync compound handler)
      const quickIntent = parseIntent(trimmed);
      if (quickIntent.type === 'search_book' && quickIntent.bookQuery) {
        if (searchMode === 'demo') {
          const demoBooks = libraryStore.searchBooks(quickIntent.bookQuery);
          const list = demoBooks.slice(0, 5).map((b, i) =>
            `${i + 1}. ${b.title} — ${b.author}${b.edition ? ` · ${b.edition}` : ''}`
          ).join('\n');
          pushAssistant(
            demoBooks.length > 0
              ? `DEMO DATA — Found ${demoBooks.length} result${demoBooks.length !== 1 ? 's' : ''} for "${quickIntent.bookQuery}":\n\n${list}`
              : `DEMO DATA — No results found for "${quickIntent.bookQuery}" in the local demo collection.`,
            { kind: 'none' }
          );
          libraryStore.logSearch(quickIntent.bookQuery!, demoBooks.length, 'demo');
          setThinking(false);
          return;
        }
        pushAssistant(`Searching the live Koha catalogue for "${quickIntent.bookQuery}"…`, { kind: 'none' });
        (async () => {
          try {
            const kohaRes = await searchKohaCatalogue(quickIntent.bookQuery!);
            const list = kohaRes.results.slice(0, 5).map((b, i) =>
              `${i + 1}. ${b.title} — ${b.author}${b.publication_year ? ` (${b.publication_year})` : ''}${b.isbn ? ` · ISBN: ${b.isbn}` : ''}`
            ).join('\n');
            pushAssistant(
              kohaRes.results.length > 0
                ? `LIVE KOHA DATA — Found ${kohaRes.total} result${kohaRes.total !== 1 ? 's' : ''} for "${quickIntent.bookQuery}":\n\n${list}`
                : `LIVE KOHA DATA — No results found for "${quickIntent.bookQuery}" in the Koha catalogue.`,
              { kind: 'none' }
            );
            libraryStore.logSearch(quickIntent.bookQuery!, kohaRes.total, 'koha');
          } catch (err) {
            const e = err as KohaClientError;
            pushAssistant(
              `I couldn't reach the live Koha catalogue: ${e.message}${e.hint ? `\n\n${e.hint}` : ''}\n\nYou can still browse demo data on the Catalogue Search page.`,
              { kind: 'none' }
            );
            libraryStore.logSearchError(quickIntent.bookQuery!, e.message);
          }
          setThinking(false);
        })();
        return;
      }

      const intents = parseCompound(trimmed);
      if (intents.length > 1) {
        const res = handleCompound(intents);
        pushAssistant(res.content, res.action);
        setRemainingIntents(res.remaining);
        const first = intents[0];
        if (first.type === 'renew_book') setLastVerb('renew');
        else if (first.type === 'reserve_book') setLastVerb('reserve');
      } else {
        const intent = parseIntent(trimmed);
        if (intent.type === 'renew_book') setLastVerb('renew');
        else if (intent.type === 'reserve_book') setLastVerb('reserve');
        else setLastVerb(null);
        const res = handleIntent(intent);
        pushAssistant(res.content, res.action);
        setRemainingIntents([]);
      }
      setThinking(false);
    }, 600);
  }, [thinking, pendingAction, remainingIntents, pushAssistant, resolveConfirm, resolvePick, searchMode]);

  useEffect(() => { sendRef.current = send; }, [send]);

  const handleConfirm = () => { if (!pendingAction) return; setThinking(true); setTimeout(resolveConfirm, 400); };
  const handleCancel = () => {
    if (remainingIntents.length > 0) {
      const res = resumeCompound(remainingIntents, 'Okay, I skipped that step.');
      pushAssistant(res.content, res.action);
      setRemainingIntents(res.remaining);
    } else {
      pushAssistant('Okay, I cancelled that action. No changes were made.');
      libraryStore.logCancelled('', 'User rejected confirmation.');
    }
    setPendingAction(null);
  };
  const handlePick = (bookId: string) => { setThinking(true); setTimeout(() => resolvePick(bookId), 300); };
  const toggleMic = () => { if (listening) speech.stopListening(); else speech.startListening(); };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Library Assistant</h1>
            <p className="mt-1 text-sm text-gray-500">Speak or type. I'll check policies and ask for approval before any action.</p>
          </div>
          <div className="flex items-center gap-2">
            {!sttSupported && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                Voice input unsupported — text chat works
              </span>
            )}
            {speaking && (
              <button
                onClick={stopSpeaking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                aria-label="Stop speaking"
                title="Stop voice playback"
              >
                <Square className="h-4 w-4 fill-current" /> Stop Speaking
              </button>
            )}
            <button
              onClick={speech.toggleMute}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${muted ? 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50' : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
              aria-label={muted ? 'Unmute voice' : 'Mute voice'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {muted ? 'Muted' : 'Voice on'}
            </button>
            <button
              onClick={toggleMic}
              disabled={!sttSupported}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${listening ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-navy-700 text-white hover:bg-navy-800'}`}
              aria-label={listening ? 'Stop listening' : 'Start listening'}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? 'Stop' : 'Speak'}
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-gray-50 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-navy-700 text-white">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-navy-700 text-white' : 'border border-gray-200 bg-white text-gray-700 shadow-sm'}`}>
                <div className="space-y-0.5 leading-relaxed">{formatContent(m.content)}</div>
                {m.action?.kind === 'choose_book' && m.action.options?.map((id, i) => {
                  const book = libraryStore.getBook(id);
                  if (!book) return null;
                  return (
                    <button key={id} onClick={() => handlePick(id)} className="mt-2 block w-full rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-left text-xs text-purple-800 hover:bg-purple-100">
                      <span className="font-medium">{i + 1}.</span> {book.title}
                      <span className="block text-purple-500">{book.author} · {book.edition}</span>
                    </button>
                  );
                })}
              </div>
              {m.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-300 text-white">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {thinking && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-navy-700 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          )}

          {pendingAction && (pendingAction.kind === 'confirm_renewal' || pendingAction.kind === 'confirm_reservation' || pendingAction.kind === 'confirm_renew_all') && (
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={handleConfirm} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {pendingAction.confirmLabel ?? 'Confirm'}
              </button>
              <button onClick={handleCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <XCircle className="h-4 w-4" /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {(listening || interim || speechError) && (
        <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2 text-sm">
            {speechError ? (
              <>
                <span className="text-rose-700">{speechError}</span>
                <button onClick={() => speech.startListening()} className="ml-auto rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700">Try again</button>
                <button onClick={() => speech.clearError()} className="rounded-md px-2 py-1 text-xs font-medium text-rose-500 hover:text-rose-700">Dismiss</button>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                </span>
                <span className="font-medium text-rose-700">Listening…</span>
                {interim && <span className="text-rose-600">{interim}</span>}
                <button onClick={toggleMic} className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-rose-500 hover:text-rose-700">Stop</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 bg-white px-4 py-3 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100">
              {s.includes('and') || s.includes('reserved') ? <Sparkles className="h-3 w-3" /> : null}
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto mt-3 flex max-w-2xl items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={sttSupported ? 'Type or speak your request…' : 'Type your request…'}
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
          />
          {sttSupported && (
            <button type="button" onClick={toggleMic} className={`inline-flex h-11 w-11 items-center justify-center rounded-xl transition ${listening ? 'bg-rose-600 text-white hover:bg-rose-700' : 'border border-gray-300 bg-white text-navy-700 hover:bg-navy-50'}`} aria-label={listening ? 'Stop listening' : 'Speak'}>
              {listening ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
          <button type="submit" disabled={!input.trim() || thinking} className="inline-flex items-center justify-center rounded-xl bg-navy-700 px-4 py-2.5 text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
