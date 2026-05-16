const { chatComplete: minimaxChat } = require('./minimax');
const { openaiChatComplete } = require('./openaiChat');
const { resolvePitchLlmProvider } = require('../utils/llmProviders');

/**
 * Chat completion for pitch deck, investor Q&A, and marketing pack.
 * Uses OpenAI with JSON mode when configured; falls back to MiniMax on failure.
 */
async function pitchChatComplete(system, user, opts = {}) {
  const provider = resolvePitchLlmProvider();

  if (provider === 'openai') {
    try {
      return await openaiChatComplete(system, user, {
        jsonMode: true,
        maxTokens: opts.maxTokens ?? 8192,
        temperature: opts.temperature ?? 0.6,
        model: opts.model,
      });
    } catch (err) {
      console.warn('OpenAI pitch LLM failed, trying MiniMax:', err.message);
    }
  }

  return minimaxChat(system, user, {
    temperature: opts.temperature ?? 0.7,
    model: opts.model,
  });
}

module.exports = { pitchChatComplete, resolvePitchLlmProvider };
