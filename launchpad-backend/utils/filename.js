function slugify(input, maxLen = 50) {
  if (!input) return '';
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[^a-zA-Z0-9 \-_]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a human-readable filename for a pitch deck download.
 * e.g. LaunchPad-Pitch-Deck-AI-Tutoring-Platform-2026-05-16.pdf
 */
function pitchDeckFilename(concept = {}, opts = {}) {
  const candidates = [concept?.productType, concept?.summary, concept?.industry];
  const topic = slugify(candidates.find((s) => typeof s === 'string' && s.trim()) || 'Pitch');
  const date = new Date().toISOString().slice(0, 10);
  const ext = opts.ext || 'pdf';
  const stem = ['LaunchPad-Pitch-Deck', topic, date].filter(Boolean).join('-');
  return `${stem}.${ext}`;
}

/**
 * Build a human-readable filename for a campaign ZIP download.
 * e.g. LaunchPad-Campaign-Small-Clothing-Brand-2026-05-16.zip
 */
function campaignFilename(campaign = {}, opts = {}) {
  const candidates = [campaign?.description, campaign?.tone];
  const topic = slugify(
    candidates.find((s) => typeof s === 'string' && s.trim()) || 'Campaign'
  );
  const date = new Date().toISOString().slice(0, 10);
  const ext = opts.ext || 'zip';
  const stem = ['LaunchPad-Campaign', topic, date].filter(Boolean).join('-');
  return `${stem}.${ext}`;
}

/**
 * Append Supabase Storage `?download=<name>` so the browser downloads with a
 * meaningful filename instead of the raw storage path.
 */
function appendDownloadParam(url, filename) {
  if (!url || !filename) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('download', filename);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}download=${encodeURIComponent(filename)}`;
  }
}

module.exports = {
  slugify,
  pitchDeckFilename,
  campaignFilename,
  appendDownloadParam,
};
