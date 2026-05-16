function marketingPrompt(session) {
  return {
    system: `Generate marketing starter pack. Respond ONLY with valid JSON:
{
  "marketingPack": {
    "taglines": string[] (3),
    "heroCopy": string,
    "socialPosts": { "instagram": string, "linkedin": string, "twitter": string },
    "coldEmail": string,
    "pressRelease": string,
    "seoKeywords": string[]
  }
}`,
    user: `Marketing for:\n${JSON.stringify(session.concept_summary)}`,
  };
}

module.exports = { marketingPrompt };
