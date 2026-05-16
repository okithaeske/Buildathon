function capturePrompt(transcript) {
  return {
    system: `You extract structured business concept data from founder transcripts.
Respond with ONLY valid JSON, no markdown:
{
  "industry": string,
  "audience": string,
  "productType": string,
  "geography": string,
  "summary": string (2-3 sentences)
}`,
    user: `Extract concept from this founder idea:\n\n${transcript}`,
  };
}

module.exports = { capturePrompt };
