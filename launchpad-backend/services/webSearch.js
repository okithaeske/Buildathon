const { isMockAi } = require('../utils/config');

const BASE_URL = (process.env.MINIMAX_API_BASE || 'https://api.minimax.io').replace(/\/$/, '');
/** MiniMax coding_plan search rejects very long queries; keep under common provider limits */
const MAX_QUERY_LENGTH = 400;

function normalizeQuery(query) {
  const s = String(query ?? '').trim();
  return s.slice(0, MAX_QUERY_LENGTH);
}

/**
 * Normalize URL from a search hit (various response shapes).
 * @returns {string[]}
 */
function urlsFromHit(hit) {
  if (!hit || typeof hit !== 'object') return [];
  const u = hit.link || hit.url || hit.href || hit.source || hit.display_url || hit.canonical_url;
  return typeof u === 'string' && u.startsWith('http') ? [u] : [];
}

/**
 * Pull organic / web search results array from MiniMax search API JSON (defensive).
 */
function extractResultItems(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload.organic,
    payload.organic_results,
    payload.results,
    payload.items,
    payload.data?.organic,
    payload.data?.organic_results,
    payload.data?.results,
    payload.data?.items,
    payload.search_results,
    payload.web_results,
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) return arr;
  }

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    const inner = payload.data.organic_results || payload.data.results;
    if (Array.isArray(inner)) return inner;
  }

  return [];
}

function buildAnswerFromItems(items, fallbackQuery) {
  if (!items.length) return `No structured results for: ${fallbackQuery}`;
  const parts = items.map((r, i) => {
    const title = r.title || r.name || r.headline || `Result ${i + 1}`;
    const snippet = r.snippet || r.content || r.description || r.summary || r.text || '';
    return `### ${title}\n${snippet}`.trim();
  });
  return parts.join('\n\n');
}

/**
 * MiniMax Token Plan web search (`POST /v1/coding_plan/search`).
 * Same shape as legacy Tavily: { answer, citations }.
 *
 * Docs: MiniMax `POST /v1/coding_plan/search` — body `{ q, count }` (Token Plan key).
 */
async function search(query, options = {}) {
  const qTrim = normalizeQuery(query);
  if (!qTrim) {
    throw new Error('MiniMax search: empty query');
  }

  if (isMockAi()) {
    return {
      answer: `Mock research result for: ${qTrim}`,
      citations: ['https://example.com/source-1', 'https://example.com/source-2'],
    };
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY is not set');

  const count = Math.min(10, Math.max(1, options.maxResults ?? 5));

  const url = `${BASE_URL}/v1/coding_plan/search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: qTrim, count }),
  });

  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`MiniMax search: invalid JSON ${res.status} ${text.slice(0, 200)}`);
  }

  const code = data?.base_resp?.status_code;
  if (code !== undefined && code !== 0) {
    throw new Error(`MiniMax search: ${data.base_resp?.status_msg || code}`);
  }

  if (!res.ok) {
    throw new Error(`MiniMax search error: ${res.status} ${text.slice(0, 500)}`);
  }

  const itemsRaw = extractResultItems(data);
  const items = itemsRaw.slice(0, count);
  const citations = [...new Set(items.flatMap(urlsFromHit))];
  let answer = buildAnswerFromItems(items, qTrim);

  const extraAnswer = typeof data.answer === 'string' && data.answer.trim()
    ? data.answer.trim()
    : typeof data.data?.answer === 'string'
      ? data.data.answer.trim()
      : '';

  if (extraAnswer && !answer.includes(extraAnswer.slice(0, 50))) {
    answer = extraAnswer ? `${extraAnswer}\n\n${answer}` : answer;
  }

  if (!answer || answer.startsWith('No structured results')) {
    answer = citations.length ? `Sources found (${citations.length}). See citations.` : answer;
  }

  return {
    answer: answer || `No results for: ${qTrim}`,
    citations,
  };
}

module.exports = { search, MAX_QUERY_LENGTH, normalizeQuery };
