function marketingPrompt(session) {
  return {
    system: `Generate marketing starter pack. Respond ONLY with valid JSON — real strings and arrays, no TypeScript types:
{
  "marketingPack": {
    "taglines": ["...", "...", "..."],
    "heroCopy": "...",
    "socialPosts": { "instagram": "...", "linkedin": "...", "twitter": "..." },
    "coldEmail": "...",
    "pressRelease": "...",
    "seoKeywords": ["...", "..."]
  }
}`,
    user: `Marketing for:\n${JSON.stringify(session.concept_summary)}`,
  };
}

module.exports = { marketingPrompt };
