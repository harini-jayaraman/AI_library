export interface KohaResult {
  biblio_id: number;
  title: string;
  author: string;
  publication_year: string | null;
  isbn: string | null;
  edition: string | null;
  item_type: string | null;
}

export interface KohaSearchResponse {
  results: KohaResult[];
  total: number;
  query: string;
  source: 'koha';
}

export interface KohaSearchError {
  error: string;
  detail?: string;
  hint?: string;
}

export type KohaStatus = 'unknown' | 'connected' | 'temporarily_unavailable' | 'checking';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/koha-search`;
const HEALTH_TIMEOUT_MS = 6000;
const HEALTH_RETRIES = 2;
const HEALTH_RETRY_DELAY_MS = 1500;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
    headers['Authorization'] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
  }
  return headers;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchKohaCatalogue(query: string): Promise<KohaSearchResponse> {
  const params = new URLSearchParams({ q: query });
  const apiUrl = `${EDGE_FUNCTION_URL}?${params}`;
  const res = await fetch(apiUrl, { headers: getHeaders() });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as KohaSearchError;
    throw new KohaClientError(err.error, err.hint, err.detail, res.status);
  }
  return (await res.json()) as KohaSearchResponse;
}

async function pingHealthEndpoint(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(EDGE_FUNCTION_URL, {
      headers: getHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.status === 'connected';
  } catch {
    return false;
  }
}

export async function checkKohaConnection(): Promise<KohaStatus> {
  for (let attempt = 0; attempt <= HEALTH_RETRIES; attempt++) {
    const ok = await pingHealthEndpoint();
    if (ok) return 'connected';
    if (attempt < HEALTH_RETRIES) {
      await sleep(HEALTH_RETRY_DELAY_MS);
    }
  }
  return 'temporarily_unavailable';
}

export class KohaClientError extends Error {
  hint?: string;
  detail?: string;
  status: number;
  constructor(message: string, hint?: string, detail?: string, status = 0) {
    super(message);
    this.name = 'KohaClientError';
    this.hint = hint;
    this.detail = detail;
    this.status = status;
  }
}
