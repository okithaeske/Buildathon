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
  const { industry, audience, productType, geography, summary } = concept;
  return [
    `Direct competitors for ${productType} targeting ${audience} in ${geography}. Industry: ${industry}. ${summary}`,
    `Similar products globally on Product Hunt, G2, app stores for: ${summary}`,
    `Regional variants and local players in ${geography} for: ${productType} — ${summary}`,
  ];
}

module.exports = { scanMergePrompt, scanQueries };
