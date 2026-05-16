/**
 * Extract and parse JSON from LLM responses (may include markdown fences).
 */
function parseJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid LLM response');
  }
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const start = cleaned.indexOf('{');
  const arrStart = cleaned.indexOf('[');
  const idx =
    start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
  if (idx > 0) cleaned = cleaned.slice(idx);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (end > 0) cleaned = cleaned.slice(0, end + 1);
  return JSON.parse(cleaned);
}

/**
 * Parse LLM JSON; on failure call retryFn once (e.g. stricter second chat completion).
 */
async function parseJsonWithRetry(text, retryFn) {
  try {
    return parseJson(text);
  } catch (firstErr) {
    if (!retryFn) throw firstErr;
    const second = await retryFn();
    return parseJson(second);
  }
}

module.exports = { parseJson, parseJsonWithRetry };
