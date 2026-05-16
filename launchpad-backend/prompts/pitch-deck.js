function pitchDeckPrompt(session) {
  return {
    system: `Create a 10-slide investor pitch deck narrative. Respond ONLY with valid JSON:
{ "pitchDeck": [{ "slide": number, "title": string, "content": string }] }
Slides: Hook, Problem, Solution, Market Size, Business Model, Traction, Competition, Go-to-Market, Team, The Ask`,
    user: `Build pitch deck for:\n${JSON.stringify({
      concept: session.concept_summary,
      profile: session.idea_profile,
      scan: session.scan_result,
      viability: session.viability_score,
    })}`,
  };
}

module.exports = { pitchDeckPrompt };
