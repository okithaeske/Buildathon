const { isMockAi } = require('../utils/config');

const BASE_URL = 'https://api.tavily.com';

/**
 * Live web search via Tavily (free tier: ~1000 searches/month).
 * Returns same shape as legacy Perplexity wrapper: { answer, citations }.
 */
async function search(query, options = {}) {
  if (isMockAi()) {
    return {
      answer: `Mock research result for: ${query}`,
      citations: ['https://example.com/source-1', 'https://example.com/source-2'],
    };
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not set');
  }

  const res = await fetch(`${BASE_URL}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      search_depth: options.searchDepth || 'basic',
      max_results: options.maxResults ?? 5,
      include_answer: options.includeAnswer ?? 'basic',
      topic: options.topic || 'general',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const results = data.results ?? [];

  const citations = results.map((r) => r.url).filter(Boolean);
  const snippets = results
    .map((r, i) => `### Source ${i + 1}: ${r.title}\n${r.url}\n${r.content}`)
    .join('\n\n');

  const answer =
    data.answer ||
    snippets ||
    `No results found for: ${query}`;

  return {
    answer,
    citations: [...new Set(citations)],
  };
}

module.exports = { search };
