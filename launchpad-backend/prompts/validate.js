function validatePrompt(session) {
  return {
    system: `Score startup viability. Respond ONLY with valid JSON — use numbers and strings, no TypeScript types:
{
  "overall": 75,
  "breakdown": {
    "marketOpportunity": 80,
    "competitiveRisk": 40,
    "legalComplexity": 30,
    "differentiation": 70
  },
  "summary": "Two sentence viability summary."
}
competitiveRisk and legalComplexity: lower scores mean safer/simpler.`,
    user: `Score this refined idea:
Concept: ${JSON.stringify(session.concept_summary)}
Idea profile: ${JSON.stringify(session.idea_profile)}
Scan: ${JSON.stringify(session.scan_result)}
Audit: ${JSON.stringify(session.audit_result)}`,
  };
}

module.exports = { validatePrompt };
