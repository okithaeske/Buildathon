const AUDIT_QUERY_MAX = 400;

function auditQuery(concept) {
  const c = concept && typeof concept === 'object' ? concept : {};
  const industry = String(c.industry || 'unknown industry').slice(0, 120).trim();
  const productType = String(c.productType || 'unknown product').slice(0, 120).trim();
  const geography = String(c.geography || 'unknown region').slice(0, 120).trim();
  const q =
    `Legal and regulatory requirements for ${productType} in ${industry}, operating in ${geography}. Include licensing, data privacy, industry-specific regulations. Current 2024-2025 information.`;
  return q.length <= AUDIT_QUERY_MAX ? q : q.slice(0, AUDIT_QUERY_MAX);
}

function auditMergePrompt(concept, researchAnswer, citations) {
  return {
    system: `You are a startup risk analyst. Respond with ONLY one JSON object — no markdown fences, no TypeScript types.

{
  "risks": [
    {
      "category": "legal",
      "description": "Specific risk description",
      "severity": "high",
      "mitigation": "How to reduce or address this risk"
    }
  ],
  "citations": ["https://example.com/source"]
}

Rules:
- Include 3-6 risks
- category must be one of: legal, ethical, operational
- severity must be one of: high, medium, low
- Use real string values only`,
    user: `Concept:\n${JSON.stringify(concept)}\n\nRegulatory research:\n${researchAnswer}\n\nCitations: ${JSON.stringify(citations)}`,
  };
}

module.exports = { auditQuery, auditMergePrompt };
