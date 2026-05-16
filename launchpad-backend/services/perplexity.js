const { isMock } = require('../utils/mock');

const BASE_URL = 'https://api.perplexity.ai';

async function search(query, model = 'sonar-pro') {
  if (isMock()) {
    return {
      answer: `Mock research result for: ${query}`,
      citations: ['https://example.com/source-1', 'https://example.com/source-2'],
    };
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: query }],
      return_citations: true,
      return_related_questions: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Perplexity API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    answer: data.choices[0].message.content,
    citations: data.citations ?? [],
  };
}

module.exports = { search };
