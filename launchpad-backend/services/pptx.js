const PptxGenJS = require('pptxgenjs');
const { uploadFile } = require('./supabase');
const { fetchImageBuffer } = require('./images');

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const BRAND_NAVY = '1A1A2E';
const BRAND_INDIGO = '6366F1';
const TEXT_WHITE = 'FFFFFF';
const TEXT_DIM = 'E8E8F2';

async function toEmbeddableData(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:')) return imageUrl;
  try {
    const buffer = await fetchImageBuffer(imageUrl);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.warn('Slide image fetch failed:', err.message);
    return null;
  }
}

function addBackground(pptx, slide, imageData) {
  if (imageData) {
    slide.addImage({
      data: imageData,
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      sizing: { type: 'cover', w: SLIDE_W, h: SLIDE_H },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      fill: { color: '000000', transparency: 45 },
      line: { type: 'none' },
    });
  } else {
    slide.background = { color: BRAND_NAVY };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.18,
      h: SLIDE_H,
      fill: { color: BRAND_INDIGO },
      line: { type: 'none' },
    });
  }
}

function addFooter(slide, index, total) {
  slide.addText(`LaunchPad AI  ·  ${index + 1} / ${total}`, {
    x: 0.6,
    y: SLIDE_H - 0.45,
    w: SLIDE_W - 1.2,
    h: 0.3,
    fontSize: 10,
    color: TEXT_DIM,
    fontFace: 'Calibri',
    align: 'left',
  });
}

function renderTitleSlide(slide, s) {
  slide.addText(s.title || 'Pitch', {
    x: 0.8,
    y: 2.6,
    w: SLIDE_W - 1.6,
    h: 1.6,
    fontSize: 56,
    bold: true,
    color: TEXT_WHITE,
    fontFace: 'Calibri',
    align: 'center',
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: 1.5,
      y: 4.2,
      w: SLIDE_W - 3,
      h: 0.9,
      fontSize: 22,
      color: TEXT_DIM,
      fontFace: 'Calibri',
      align: 'center',
      italic: true,
    });
  }
}

function renderMetricSlide(slide, s) {
  slide.addText(s.title || '', {
    x: 0.8,
    y: 0.8,
    w: SLIDE_W - 1.6,
    h: 0.8,
    fontSize: 22,
    color: TEXT_DIM,
    fontFace: 'Calibri',
    align: 'center',
  });
  slide.addText(s.subtitle || s.content || '', {
    x: 0.8,
    y: 2.2,
    w: SLIDE_W - 1.6,
    h: 2.5,
    fontSize: 54,
    bold: true,
    color: TEXT_WHITE,
    fontFace: 'Calibri',
    align: 'center',
  });
  const bullets = Array.isArray(s.bullets) ? s.bullets.filter(Boolean) : [];
  if (bullets.length) {
    slide.addText(bullets.join('   ·   '), {
      x: 0.8,
      y: 5.0,
      w: SLIDE_W - 1.6,
      h: 1.0,
      fontSize: 18,
      color: TEXT_DIM,
      fontFace: 'Calibri',
      align: 'center',
    });
  }
}

function renderBulletSlide(slide, s) {
  slide.addText(s.title || '', {
    x: 0.8,
    y: 0.7,
    w: SLIDE_W - 1.6,
    h: 1.0,
    fontSize: 36,
    bold: true,
    color: TEXT_WHITE,
    fontFace: 'Calibri',
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: 0.8,
      y: 1.7,
      w: SLIDE_W - 1.6,
      h: 0.6,
      fontSize: 18,
      color: TEXT_DIM,
      fontFace: 'Calibri',
      italic: true,
    });
  }
  const bullets = Array.isArray(s.bullets) ? s.bullets.filter(Boolean) : [];
  if (bullets.length) {
    slide.addText(
      bullets.map((b) => ({ text: String(b), options: { bullet: { code: '25A0' } } })),
      {
        x: 0.9,
        y: 2.6,
        w: SLIDE_W - 1.8,
        h: SLIDE_H - 3.4,
        fontSize: 22,
        color: TEXT_WHITE,
        fontFace: 'Calibri',
        valign: 'top',
        paraSpaceAfter: 10,
      }
    );
  } else if (s.content) {
    slide.addText(s.content, {
      x: 0.8,
      y: 2.6,
      w: SLIDE_W - 1.6,
      h: SLIDE_H - 3.4,
      fontSize: 20,
      color: TEXT_WHITE,
      fontFace: 'Calibri',
      valign: 'top',
    });
  }
}

function renderSlide(pptx, slide, s, imageData, index, total) {
  addBackground(pptx, slide, imageData);

  const layout = s.layout || (index === 0 ? 'title' : 'bullets');
  if (layout === 'title') renderTitleSlide(slide, s);
  else if (layout === 'metric') renderMetricSlide(slide, s);
  else renderBulletSlide(slide, s);

  addFooter(slide, index, total);

  if (s.speakerNotes) {
    slide.addNotes(String(s.speakerNotes));
  }
}

function addCitationsSlide(pptx, citations) {
  if (!Array.isArray(citations) || !citations.length) return;
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_NAVY };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.18,
    h: SLIDE_H,
    fill: { color: BRAND_INDIGO },
    line: { type: 'none' },
  });
  slide.addText('Sources & citations', {
    x: 0.8,
    y: 0.7,
    w: SLIDE_W - 1.6,
    h: 0.9,
    fontSize: 32,
    bold: true,
    color: TEXT_WHITE,
    fontFace: 'Calibri',
  });
  const items = citations.slice(0, 12).map((url) => ({
    text: String(url),
    options: {
      hyperlink: { url: String(url) },
      bullet: { code: '2022' },
    },
  }));
  slide.addText(items, {
    x: 0.9,
    y: 1.9,
    w: SLIDE_W - 1.8,
    h: SLIDE_H - 2.8,
    fontSize: 14,
    color: TEXT_DIM,
    fontFace: 'Calibri',
    valign: 'top',
    paraSpaceAfter: 6,
  });
}

/**
 * Build a .pptx buffer from pitchDeck JSON slides.
 * @param {Array<Object>} pitchDeck
 * @param {{ title?: string, summary?: string }} [meta]
 * @param {{ imageUrls?: Array<string|null>, citations?: string[] }} [opts]
 */
async function buildPitchDeckPptx(pitchDeck, meta = {}, opts = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'LaunchPad AI';
  pptx.company = 'LaunchPad AI';
  pptx.title = meta.title || 'Investor Pitch Deck';
  pptx.subject = meta.summary?.slice?.(0, 200) || 'Generated pitch deck';

  const slides = Array.isArray(pitchDeck) ? pitchDeck : [];
  if (!slides.length) {
    const slide = pptx.addSlide();
    slide.background = { color: BRAND_NAVY };
    slide.addText('Pitch deck', {
      x: 0.8,
      y: 3,
      w: SLIDE_W - 1.6,
      h: 1.2,
      fontSize: 48,
      bold: true,
      color: TEXT_WHITE,
      fontFace: 'Calibri',
      align: 'center',
    });
    return pptx.write({ outputType: 'nodebuffer' });
  }

  const imageUrls = Array.isArray(opts.imageUrls) ? opts.imageUrls : [];
  const imageData = await Promise.all(
    slides.map((_, i) => toEmbeddableData(imageUrls[i] ?? null))
  );

  slides.forEach((s, index) => {
    const slide = pptx.addSlide();
    renderSlide(pptx, slide, s, imageData[index], index, slides.length);
  });

  addCitationsSlide(pptx, opts.citations);

  return pptx.write({ outputType: 'nodebuffer' });
}

/**
 * Generate PPTX and upload to Supabase `exports` bucket.
 * @returns {Promise<string|null>} public URL or null on failure
 */
async function generateAndUploadPitchPptx(pitchDeck, userId, sessionId, meta = {}, opts = {}) {
  try {
    const buffer = await buildPitchDeckPptx(pitchDeck, meta, opts);
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
