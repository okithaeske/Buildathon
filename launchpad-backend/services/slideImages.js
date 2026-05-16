const { isMockAi } = require('../utils/config');
const { generateImage } = require('./images');

const SLIDE_IMAGE_CONCURRENCY = Number(process.env.SLIDE_IMAGE_CONCURRENCY || 3);
const SLIDE_IMAGE_SIZE = process.env.SLIDE_IMAGE_SIZE || '1600x900';

const BRAND_PALETTE =
  'deep navy #1a1a2e base, indigo #6366f1 accent, soft purple gradient, white space, premium minimal startup design';

const LAYOUT_HINTS = {
  title: 'cinematic hero composition with subtle gradient lighting and abstract geometric shapes',
  bullets: 'editorial three-column layout with soft icon silhouettes, lots of negative space',
  metric: 'oversized abstract number motif with concentric rings or rising bar graphics',
  chart: 'minimalist bar-chart silhouette or concentric TAM SAM SOM circles, infographic style',
  competition: 'comparison grid silhouette, vs. layout, neutral icon tiles, no real logos',
};

function topicHint(slide) {
  const title = slide.title?.trim();
  const subtitle = slide.subtitle?.trim();
  return [title, subtitle].filter(Boolean).join(' — ').slice(0, 180);
}

/**
 * Compose a single-slide background prompt — decorative, no text baked in.
 */
function buildSlideImagePrompt(slide, sessionMeta = {}) {
  const layoutHint = LAYOUT_HINTS[slide.layout] || LAYOUT_HINTS.bullets;
  const topic = topicHint(slide) || sessionMeta.title || 'investor pitch slide';
  const concept = sessionMeta.summary?.slice?.(0, 160) || '';

  return [
    `Modern investor pitch slide background for: "${topic}".`,
    concept && `Business context: ${concept}.`,
    `Style: ${BRAND_PALETTE}. ${layoutHint}.`,
    'Editorial, designed, high contrast, 16:9 aspect ratio, flat illustration with subtle depth.',
    'No text, no letters, no words, no captions, no logos, no UI mockups, no faces.',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 900);
}

async function generateOneSlideImage(slide, index, sessionMeta, userId, sessionId) {
  const prompt = buildSlideImagePrompt(slide, sessionMeta);
  const storagePath = `${userId}/pitch-${sessionId}-slide-${index + 1}.png`;
  return generateImage(prompt, SLIDE_IMAGE_SIZE, { userId, storagePath });
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length).fill(null);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const current = cursor++;
        if (current >= items.length) return;
        try {
          results[current] = await worker(items[current], current);
        } catch (err) {
          console.warn(`Slide image ${current + 1} failed:`, err.message);
          results[current] = null;
        }
      }
    });
  await Promise.all(workers);
  return results;
}

/**
 * Generate one decorative background image per slide.
 * Returns an array aligned 1:1 with pitchDeck; entries may be null if generation failed.
 * In MOCK_AI mode returns an array of nulls so the PPTX falls back to its text-only style.
 */
async function generateSlideImages(pitchDeck, userId, sessionId, sessionMeta = {}) {
  if (!Array.isArray(pitchDeck) || !pitchDeck.length) return [];
  if (isMockAi()) return pitchDeck.map(() => null);

  return runWithConcurrency(pitchDeck, SLIDE_IMAGE_CONCURRENCY, (slide, index) =>
    generateOneSlideImage(slide, index, sessionMeta, userId, sessionId)
  );
}

module.exports = {
  buildSlideImagePrompt,
  generateSlideImages,
};
