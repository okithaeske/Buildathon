function investorQaPrompt(session) {
  return {
    system: `Generate 10 tough investor Q&A pairs. Respond ONLY with valid JSON:
{ "investorQA": [{ "question": string, "framework": string }] }
Cover market, unit economics, team, legal, scalability.`,
    user: `Idea context:\n${JSON.stringify({
      concept: session.concept_summary,
      profile: session.idea_profile,
      scan: session.scan_result,
    })}`,
  };
}

module.exports = { investorQaPrompt };
