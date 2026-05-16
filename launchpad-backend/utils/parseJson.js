/**
 * Extract and parse JSON from LLM responses (may include markdown fences).
 */

function stripCodeFences(text) {
  let cleaned = String(text).trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return cleaned;
}

/**
 * Find the first complete JSON object or array using bracket matching (respects strings).
 */
function extractJsonBlock(text) {
  const cleaned = stripCodeFences(text);
  const startObj = cleaned.indexOf('{');
  const startArr = cleaned.indexOf('[');
  let start = -1;
  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);
  if (start === -1) return null;

  const stack = [];
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      const expected = stack[stack.length - 1];
      if (ch !== expected) continue;
      stack.pop();
      if (stack.length === 0) return cleaned.slice(start, i + 1);
    }
  }

  if (stack.length > 0) {
    let partial = cleaned.slice(start);
    for (let i = stack.length - 1; i >= 0; i--) partial += stack[i];
    return partial;
  }
  return null;
}

/**
 * Apply common fixes for LLM-generated JSON.
 */
function repairJson(json) {
  let s = json
    .replace(/\uFEFF/g, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  s = s.replace(/,(\s*[}\]])/g, '$1');
  s = s.replace(/("opportunityRating"\s*:\s*)(green|amber|red)\b/gi, (_, p, v) => `${p}"${v.toLowerCase()}"`);
  s = s.replace(/("severity"\s*:\s*)(low|medium|high)\b/gi, (_, p, v) => `${p}"${v.toLowerCase()}"`);
  s = s.replace(/"(\s+)"/g, '", "');

  return s;
}

function tryParse(json) {
  return JSON.parse(json);
}

function parseJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid LLM response');
  }

  const block = extractJsonBlock(text);
  if (!block) {
    throw new Error('No JSON object found in LLM response');
  }

  const candidates = [block, repairJson(block)];
  let lastErr;
  for (const candidate of candidates) {
    try {
      return tryParse(candidate);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * Parse LLM JSON; on failure call retryFn once (e.g. stricter second chat completion).
 * retryFn receives the first parse error when available.
 */
async function parseJsonWithRetry(text, retryFn) {
  try {
    return parseJson(text);
  } catch (firstErr) {
    if (!retryFn) throw firstErr;
    const second = await retryFn(firstErr);
    return parseJson(second);
  }
}

module.exports = { parseJson, parseJsonWithRetry, extractJsonBlock, repairJson };
