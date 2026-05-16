function pitchDeckPrompt(session) {
  return {
    system: `Create a 10-slide investor pitch deck. Respond ONLY with valid JSON — real strings and numbers, no TypeScript types or placeholders:
{
  "pitchDeck": [
    {
      "slide": 1,
      "layout": "title",
      "title": "Short headline (max 6 words)",
      "subtitle": "Optional single-line tagline (max 12 words)",
      "bullets": ["Short punchy point (max 12 words)", "Another point"],
      "content": "Fallback narrative paragraph if no bullets fit",
      "speakerNotes": "1-2 sentences the founder says aloud on this slide"
    }
  ]
}

Slides in order with the layout to use:
1. Hook — layout "title", subtitle is the elevator-pitch tagline.
2. Problem — layout "bullets", 3 sharp pain points.
3. Solution — layout "bullets", 3 product capabilities mapped to the problems.
4. Market Size — layout "chart", bullets exactly ["TAM: <value>", "SAM: <value>", "SOM: <value>"].
5. Business Model — layout "bullets", revenue model and pricing.
6. Traction — layout "metric", subtitle is the single headline number (e.g. "400 waitlist signups, 92% completion").
7. Competition — layout "competition", bullets list 2-4 competitors with one-line differentiation each.
8. Go-to-Market — layout "bullets", channels and motion.
9. Team — layout "bullets", founders and key strengths.
10. The Ask — layout "metric", subtitle is the funding ask (e.g. "$500K seed — 18 months runway").

Rules:
- Every slide MUST have a "title" and "speakerNotes".
- "bullets" should contain 2-5 short strings; keep each under 15 words.
- Never include layout names, square brackets, or TypeScript-style placeholders in the values.
- Keep titles bold and concise; bullets must read at a glance.`,
    user: `Build the pitch deck using this session data:\n${JSON.stringify({
      concept: session.concept_summary,
      profile: session.idea_profile,
      scan: session.scan_result,
      viability: session.viability_score,
    })}`,
  };
}

module.exports = { pitchDeckPrompt };
