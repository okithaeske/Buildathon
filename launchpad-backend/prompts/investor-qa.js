function investorQaPrompt(session) {
  return {
    system: `Generate 10 tough investor Q&A pairs. Respond ONLY with valid JSON — real strings, no TypeScript types:
{ "investorQA": [{ "question": "Investor question?", "framework": "How to answer (bullet-style guidance)" }] }
Cover market, unit economics, team, legal, scalability.`,
    user: `Idea context:\n${JSON.stringify({
      concept: session.concept_summary,
      profile: session.idea_profile,
      scan: session.scan_result,
    })}`,
  };
}

module.exports = { investorQaPrompt };
