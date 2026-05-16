const PptxGenJS = require('pptxgenjs');
const { uploadFile } = require('./supabase');

/**
 * Build a .pptx buffer from pitchDeck JSON slides.
 * @param {Array<{ slide?: number, title?: string, content?: string }>} pitchDeck
 * @param {{ title?: string, summary?: string }} [meta]
 */
async function buildPitchDeckPptx(pitchDeck, meta = {}) {
  const pptx = new PptxGenJS();
  pptx.author = 'LaunchPad AI';
  pptx.title = meta.title || 'Investor Pitch Deck';
  pptx.subject = meta.summary?.slice?.(0, 200) || 'Generated pitch deck';

  const slides = Array.isArray(pitchDeck) ? pitchDeck : [];
  if (!slides.length) {
    const slide = pptx.addSlide();
    slide.addText('Pitch deck', { x: 0.5, y: 2, w: 9, h: 1, fontSize: 32, bold: true });
  } else {
    for (const s of slides) {
      const slide = pptx.addSlide();
      slide.background = { color: '1a1a2e' };
      slide.addText(s.title || `Slide ${s.slide ?? ''}`, {
        x: 0.6,
        y: 0.5,
        w: 8.8,
        h: 0.9,
        fontSize: 28,
        bold: true,
        color: 'FFFFFF',
      });
      slide.addText(s.content || '', {
        x: 0.6,
        y: 1.6,
        w: 8.8,
        h: 5.2,
        fontSize: 16,
        color: 'E8E8E8',
        valign: 'top',
      });
    }
  }

  return pptx.write({ outputType: 'nodebuffer' });
}

/**
 * Generate PPTX and upload to Supabase `exports` bucket.
 * @returns {Promise<string|null>} public URL or null on failure
 */
async function generateAndUploadPitchPptx(pitchDeck, userId, sessionId, meta = {}) {
  try {
    const buffer = await buildPitchDeckPptx(pitchDeck, meta);
    const path = `${userId}/pitch-${sessionId}.pptx`;
    return await uploadFile(
      'exports',
      path,
      buffer,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
  } catch (err) {
    console.warn('PPTX export failed:', err.message);
    return null;
  }
}

module.exports = { buildPitchDeckPptx, generateAndUploadPitchPptx };
