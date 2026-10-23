// Koha catalogue search edge function.
// Uses public endpoints (no auth required):
//   GET /public/items — lists items with biblio_id (paginated, 2 pages)
//   GET /public/biblios/{id} — returns MARC text for title/author extraction
//
// The Koha demo server has no public search endpoint, so we fetch all biblio
// records individually. To keep this fast enough:
//   - Use text/plain format (lighter than MARC-in-JSON)
//   - Fetch 30 records concurrently with 3s timeout each
//   - Only fetch item biblio_ids + gap IDs (biblios without items)

const KOHA_BASE = "https://koha-demo.ibict.br/api/v1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BookInfo {
  biblio_id: number;
  title: string;
  author: string;
  year: string | null;
  isbn: string | null;
  edition: string | null;
}

function extractFromMarcText(text: string): Omit<BookInfo, "biblio_id"> {
  const lines = text.split("\n").map((l) => l.trim());
  let title = "Untitled";
  let author = "Unknown";
  let year: string | null = null;
  let isbn: string | null = null;
  let edition: string | null = null;

  let currentTag = "";
  const tagValues: Record<string, string[]> = {};

  for (const line of lines) {
    // Match tag line: "245 10 _aTitle" or continuation "       _bSubtitle"
    const tagMatch = line.match(/^(\d{3})\s/);
    const contMatch = line.startsWith(" ") || line.startsWith("_");

    if (tagMatch) {
      currentTag = tagMatch[1];
      const rest = line.slice(tagMatch[0].length);
      if (!tagValues[currentTag]) tagValues[currentTag] = [];
      tagValues[currentTag].push(rest);
    } else if (contMatch && currentTag) {
      tagValues[currentTag].push(line);
    }
  }

  // Extract title from 245$a (and $b if no $a)
  const f245 = (tagValues["245"] || []).join(" ");
  const titleA = f245.match(/_a(.+?)(?:_[a-z]|$)/s);
  const titleB = f245.match(/_b(.+?)(?:_[a-z]|$)/s);
  if (titleA) title = titleA[1].trim();
  else if (titleB) title = titleB[1].trim();

  // Extract author from 100$a
  const f100 = (tagValues["100"] || []).join(" ");
  const authorA = f100.match(/_a(.+?)(?:_[a-z0-9]|$)/s);
  if (authorA) author = authorA[1].trim();

  // Extract edition from 250$a
  const f250 = (tagValues["250"] || []).join(" ");
  const edA = f250.match(/_a(.+?)(?:_[a-z]|$)/s);
  if (edA) edition = edA[1].trim();

  // Extract ISBN from 020$a
  const f020 = (tagValues["020"] || []).join(" ");
  const isbnA = f020.match(/_a(.+?)(?:_[a-z]|$)/s);
  if (isbnA) isbn = isbnA[1].trim();

  // Extract year from 260$c or 264$c
  const f260 = (tagValues["260"] || []).join(" ");
  const f264 = (tagValues["264"] || []).join(" ");
  const pubFields = [f260, f264];
  for (const f of pubFields) {
    if (year) break;
    const cMatch = f.match(/_c(.+?)(?:_[a-z]|$)/s);
    if (cMatch) {
      const ym = cMatch[1].match(/\d{4}/);
      if (ym) year = ym[0];
    }
  }

  return { title, author, year, isbn, edition };
}

async function fetchAllItemBiblioIds(): Promise<{ ids: Set<number>; maxId: number }> {
  const ids = new Set<number>();
  let page = 1;
  const perPage = 100;
  let maxId = 0;

  while (true) {
    const res = await fetch(
      `${KOHA_BASE}/public/items?_per_page=${perPage}&_page=${page}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`public/items returned ${res.status}`);
    const items = await res.json() as Array<{ biblio_id: number }>;
    if (items.length === 0) break;
    for (const item of items) {
      ids.add(item.biblio_id);
      if (item.biblio_id > maxId) maxId = item.biblio_id;
    }
    if (items.length < perPage) break;
    page++;
    if (page > 10) break;
  }

  return { ids, maxId };
}

async function fetchBiblio(id: number): Promise<BookInfo | null> {
  try {
    const res = await fetch(`${KOHA_BASE}/public/biblios/${id}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return { biblio_id: id, ...extractFromMarcText(text) };
  } catch {
    return null;
  }
}

async function handleHealthCheck(): Promise<Response> {
  try {
    const res = await fetch(`${KOHA_BASE}/public/items?_per_page=1`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return new Response(
        JSON.stringify({ status: "connected", server: "koha-demo.ibict.br" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ status: "unavailable", detail: `Koha items endpoint returned ${res.status}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ status: "unavailable", detail: message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Lightweight health check — just pings the Koha items endpoint
    if (url.pathname.endsWith("/koha-search") && !url.searchParams.has("q")) {
      return await handleHealthCheck();
    }

    const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing query parameter 'q'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 1: Fetch ALL item biblio_ids across all pages
    const { ids: itemBiblioIds, maxId: maxItemBiblioId } = await fetchAllItemBiblioIds();

    // Step 2: Find gap IDs (biblios without items) and probe a small range beyond max
    const gapIds: number[] = [];
    for (let id = 1; id <= maxItemBiblioId; id++) {
      if (!itemBiblioIds.has(id)) gapIds.push(id);
    }
    const beyondIds: number[] = [];
    for (let id = maxItemBiblioId + 1; id <= maxItemBiblioId + 5; id++) {
      beyondIds.push(id);
    }

    const allBiblioIds = [...itemBiblioIds, ...gapIds, ...beyondIds];

    // Step 3: Fetch biblio records in concurrent batches of 30 with 3s timeout
    const allBooks: BookInfo[] = [];
    const batchSize = 30;
    for (let i = 0; i < allBiblioIds.length; i += batchSize) {
      const batch = allBiblioIds.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((id) => fetchBiblio(id)));
      for (const r of results) {
        if (r) allBooks.push(r);
      }
    }

    // Step 4: Filter by query
   const results = allBooks
  .filter((b) => {
    const q = query.toLowerCase().trim();
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.isbn ?? "").toLowerCase().includes(q) || (b.year ?? "").toString().toLowerCase().includes(q);
  })  
    .map((b) => ({
        biblio_id: b.biblio_id,
        title: b.title,
        author: b.author,
        publication_year: b.year,
        isbn: b.isbn,
        edition: b.edition,
        item_type: "BK" as string | null,
      }));

    return new Response(
      JSON.stringify({ results, total: results.length, query, source: "koha" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isTimeout = message.includes("timeout") || message.includes("abort");
    return new Response(
      JSON.stringify({
        error: isTimeout ? "Koha server did not respond in time" : "Failed to reach Koha server",
        detail: message,
        hint: isTimeout
          ? "The Koha demo server at koha-demo.ibict.br may be slow or unreachable. Try again in a moment."
          : "A network or DNS error occurred while contacting the Koha server.",
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
