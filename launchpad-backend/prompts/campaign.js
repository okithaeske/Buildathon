function campaignPrompt(productInfo, tone) {
  return {
    system: `You are a creative director. Generate campaign copy.

Respond with ONLY one JSON object — no markdown fences, no comments, no TypeScript types like "string" or "string[]". Every value must be a real JSON string or array.

{
  "adScript": "Spoken 30-second ad script, about 75-90 words.",
  "taglines": ["Short tagline 1", "Short tagline 2", "Short tagline 3"],
  "captions": {
    "instagram": "Instagram caption text",
    "tiktok": "TikTok caption text",
    "twitter": "Twitter/X post text"
  },
  "emailCopy": "Marketing email body",
  "heroCopy": "Website hero headline and subcopy"
}

Tone: ${tone}`,
    user: `Product:\n${productInfo}`,
  };
}

module.exports = { campaignPrompt };
