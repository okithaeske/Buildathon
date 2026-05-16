function trim(str, maxLen = 80) {
  if (typeof str !== 'string') return '';
  const cleaned = str.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`;
}

function firstSentence(text) {
  if (typeof text !== 'string') return '';
  const match = text.match(/^[^.!?\n]+[.!?]?/);
  return (match ? match[0] : text).trim();
}

/**
 * Human-readable title for a pitch session card.
 * Prefers productType → first sentence of summary → industry → fallback.
 */
function pitchTitle(concept = {}, fallback = 'Untitled pitch') {
  if (!concept || typeof concept !== 'object') return fallback;
  const productType = trim(concept.productType, 80);
  if (productType) return productType;
  const summary = trim(firstSentence(concept.summary), 80);
  if (summary) return summary;
  const industry = trim(concept.industry, 80);
  if (industry) return industry;
  return fallback;
}

/**
 * Human-readable title for a campaign card.
 * Prefers description → tone-styled fallback.
 */
function campaignTitle(campaign = {}, fallback = 'Untitled campaign') {
  if (!campaign || typeof campaign !== 'object') return fallback;
  const description = trim(firstSentence(campaign.description), 80);
  if (description) return description;
  return fallback;
}

module.exports = { pitchTitle, campaignTitle };
