function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Pitch deck + investor Q&A + marketing: openai (default if key set) | minimax */
function resolvePitchLlmProvider() {
  const explicit = process.env.PITCH_LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === 'openai' || explicit === 'minimax') return explicit;
  if (isOpenAiConfigured()) return 'openai';
  return 'minimax';
}

module.exports = { isOpenAiConfigured, resolvePitchLlmProvider };
