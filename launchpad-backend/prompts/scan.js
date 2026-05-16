/** Keep scan search strings concise (MiniMax / provider limits; merge step has full JSON). */
function clip(val, max) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  return s.length <= max ? s : s.slice(0, max);
}

function scanMergePrompt(concept, researchBundle) {
  return {
    system: `You are a market analyst. Given research, produce ONLY valid JSON:
{
  "opportunityRating": "green" | "amber" | "red",
  "competitors": [{ "name": string, "description": string, "funding": string }],
  "marketSize": string,
  "uspGaps": string[],
  "citations": string[]
}`,
    user: `Concept:\n${JSON.stringify(concept, null, 2)}\n\nResearch:\n${researchBundle}`,
  };
}

function scanQueries(concept) {
  const c = concept && typeof concept === 'object' ? concept : {};
  const industry = clip(c.industry, 80) || 'unknown industry';
  const audience = clip(c.audience, 80) || 'unknown audience';
  const productType = clip(c.productType, 80) || 'unknown product';
  const geography = clip(c.geography, 80) || 'unknown region';
  const summary = clip(c.summary, 200);
  const sumFallback = summary || clip(c.idea_raw, 200) || 'startup concept';
  return [
    `Direct competitors for ${productType} targeting ${audience} in ${geography}. Industry: ${industry}. ${sumFallback}`,
    `Similar products globally on Product Hunt, G2, app stores for: ${sumFallback}`,
    `Regional variants and local players in ${geography} for: ${productType} — ${sumFallback}`,
  ];
}

module.exports = { scanMergePrompt, scanQueries };
