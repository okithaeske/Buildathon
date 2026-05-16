function pitchDeckPrompt(session) {
  return {
    system: `Create a 10-slide investor pitch deck narrative. Respond ONLY with valid JSON — real strings and numbers, no TypeScript types:
{ "pitchDeck": [{ "slide": 1, "title": "Hook", "content": "Slide narrative text" }] }
Slides in order: Hook, Problem, Solution, Market Size, Business Model, Traction, Competition, Go-to-Market, Team, The Ask`,
    user: `Build pitch deck for:\n${JSON.stringify({
      concept: session.concept_summary,
      profile: session.idea_profile,
      scan: session.scan_result,
      viability: session.viability_score,
    })}`,
  };
}

module.exports = { pitchDeckPrompt };
