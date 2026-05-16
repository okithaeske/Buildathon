function auditQuery(concept) {
  const { industry, productType, geography } = concept;
  return `Legal and regulatory requirements for ${productType} in ${industry}, operating in ${geography}. Include licensing, data privacy, industry-specific regulations. Current 2024-2025 information.`;
}

function auditMergePrompt(concept, researchAnswer, citations) {
  return {
    system: `You are a startup risk analyst. Produce ONLY valid JSON:
{
  "risks": [{
    "category": "legal" | "ethical" | "operational",
    "description": string,
    "severity": "high" | "medium" | "low",
    "mitigation": string
  }],
  "citations": string[]
}
Include 3-6 risks. Add disclaimer that this is not legal advice.`,
    user: `Concept:\n${JSON.stringify(concept)}\n\nRegulatory research:\n${researchAnswer}\n\nCitations: ${JSON.stringify(citations)}`,
  };
}

module.exports = { auditQuery, auditMergePrompt };
