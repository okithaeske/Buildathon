/** Keep scan search strings concise (MiniMax / provider limits; merge step has full JSON). */
function clip(val, max) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  return s.length <= max ? s : s.slice(0, max);
}

function scanMergePrompt(concept, researchBundle) {
  return {
    system: `You are a market analyst. Respond with ONLY one JSON object — no markdown fences, no TypeScript types.

{
  "opportunityRating": "green",
  "competitors": [
    { "name": "Competitor A", "description": "What they do", "funding": "Unknown or amount" }
  ],
  "marketSize": "TAM/SAM/SOM summary as one string",
  "uspGaps": ["Gap 1", "Gap 2"],
  "citations": ["https://example.com/source"]
}

Rules:
- opportunityRating must be exactly: green, amber, or red
- Use real string values only`,
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
