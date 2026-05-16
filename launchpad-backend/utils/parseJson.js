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
  return JSON.parse(cleaned);
}

module.exports = { parseJson };
