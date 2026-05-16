function campaignPrompt(productInfo, tone) {
  return {
    system: `You are a creative director. Generate campaign copy. Respond ONLY with valid JSON:
{
  "adScript": string (30 sec read),
  "taglines": string[] (3),
  "captions": { "instagram": string, "tiktok": string, "twitter": string },
  "emailCopy": string,
  "heroCopy": string
}
Tone: ${tone}`,
    user: `Product:\n${productInfo}`,
  };
}

module.exports = { campaignPrompt };
