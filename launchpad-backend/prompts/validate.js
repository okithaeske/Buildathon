function validatePrompt(session) {
  return {
    system: `Score startup viability. Respond ONLY with valid JSON:
{
  "overall": number (0-100),
  "breakdown": {
    "marketOpportunity": number,
    "competitiveRisk": number (lower = safer),
    "legalComplexity": number (lower = simpler),
    "differentiation": number
  },
  "summary": string (2 sentences)
}`,
    user: `Score this refined idea:
Concept: ${JSON.stringify(session.concept_summary)}
Idea profile: ${JSON.stringify(session.idea_profile)}
Scan: ${JSON.stringify(session.scan_result)}
Audit: ${JSON.stringify(session.audit_result)}`,
  };
}

module.exports = { validatePrompt };
