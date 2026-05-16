/**
 * OpenAI Chat Completions (shared by pitch deck, campaign banner prompts, etc.)
 */
const { isOpenAiConfigured } = require('../utils/llmProviders');

async function openaiChatComplete(system, user, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const body = {
    model: opts.model || process.env.OPENAI_PROMPT_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4096,
  };

  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI chat error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error('OpenAI returned empty chat response');
  return content.trim();
}

module.exports = { openaiChatComplete, isOpenAiConfigured };
