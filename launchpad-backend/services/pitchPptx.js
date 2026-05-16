const PptxGenJS = require('pptxgenjs');
const { fetchImageBuffer } = require('./images');
const { uploadFile } = require('./supabase');

const BRAND_NAVY = '1A1A2E';
const BRAND_INDIGO = '6366F1';
const BRAND_PURPLE = '8B5CF6';
const TEXT_WHITE = 'FFFFFF';
const TEXT_DIM = 'E8E8F2';
const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function bulletsArray(slide) {
  return Array.isArray(slide.bullets)
    ? slide.bullets.map((b) => String(b).trim()).filter(Boolean)
    : [];
}

function parseTamSamSom(bullets) {
  const result = { TAM: null, SAM: null, SOM: null };
  let matched = 0;
  for (const raw of bullets) {
    const m = String(raw).match(/^\s*(TAM|SAM|SOM)\s*[:\-–—]\s*(.+?)\s*$/i);
    if (m) {
      const key = m[1].toUpperCase();
      if (!result[key]) {
        result[key] = m[2].trim();
        matched += 1;
      }
    }
  }
  return matched >= 2 ? result : null;
}

function parseCompetitionRow(bullet) {
  const text = String(bullet).trim();
  const m = text.match(/^(.+?)\s*[—–\-:|]\s*(.+)$/);
  if (m) return { name: m[1].trim(), detail: m[2].trim() };
  return { name: text, detail: '' };
}

async function imageDataUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (imageUrl.startsWith('data:')) return imageUrl;
  try {
    const buffer = await fetchImageBuffer(imageUrl);
    return `image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.warn('PPTX slide image fetch failed:', err.message);
    return null;
  }
}

function addBrandBackdrop(slide, pptx, hasImage) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    fill: { color: BRAND_NAVY, transparency: hasImage ? 35 : 0 },
    line: { color: BRAND_NAVY, transparency: 100 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.12,
    h: '100%',
    fill: { type: 'solid', color: BRAND_INDIGO },
    line: { transparency: 100 },
  });
}

async function applySlideBackground(slide, pptx, imageUrl) {
  slide.background = { color: BRAND_NAVY };
  const data = await imageDataUrl(imageUrl);
  if (data) {
    slide.addImage({ data, x: 0, y: 0, w: '100%', h: '100%', sizing: { type: 'cover' } });
    addBrandBackdrop(slide, pptx, true);
    return;
  }
  addBrandBackdrop(slide, pptx, false);
}

function addFooter(slide, index, total) {
  slide.addText('Pitch Smasher', {
    x: 0.55,
    y: 5.15,
    w: 4,
    h: 0.3,
    fontSize: 9,
    color: TEXT_DIM,
    transparency: 30,
  });
  slide.addText(`${index + 1} / ${total}`, {
    x: 8.8,
    y: 5.15,
    w: 1.2,
    h: 0.3,
    fontSize: 9,
    color: TEXT_DIM,
    align: 'right',
    transparency: 30,
  });
}

function addTitleSlide(slide, data, index, total) {
  const subtitle = data.subtitle || data.content || '';
  slide.addText(data.title || 'Pitch', {
    x: 0.75,
    y: 1.6,
    w: 8.5,
    h: 1.4,
    fontSize: 44,
    bold: true,
    color: TEXT_WHITE,
    align: 'center',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 1.2,
      y: 3.1,
      w: 7.6,
      h: 1.2,
      fontSize: 20,
      color: TEXT_DIM,
      align: 'center',
    });
  }
  addFooter(slide, index, total);
}

function addBulletsSlide(slide, data, index, total) {
  const bullets = bulletsArray(data);
  slide.addText(data.title || '', {
    x: 0.75,
    y: 0.55,
    w: 8.8,
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: TEXT_WHITE,
  });
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.75,
      y: 1.25,
      w: 8.8,
      h: 0.55,
      fontSize: 16,
      italic: true,
      color: TEXT_DIM,
    });
  }
  const bodyY = data.subtitle ? 1.95 : 1.45;
  if (bullets.length) {
    slide.addText(
      bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      {
        x: 0.85,
        y: bodyY,
        w: 8.6,
        h: 3.1,
        fontSize: 20,
        color: TEXT_WHITE,
        paraSpaceAfter: 10,
      }
    );
  } else if (data.content) {
    slide.addText(data.content, {
      x: 0.85,
      y: bodyY,
      w: 8.6,
      h: 3.1,
      fontSize: 20,
      color: TEXT_WHITE,
    });
  }
  addFooter(slide, index, total);
}

function addMetricSlide(slide, data, index, total) {
  const bullets = bulletsArray(data);
  const hero = data.subtitle || data.content || '';
  slide.addText((data.title || '').toUpperCase(), {
    x: 0.75,
    y: 0.9,
    w: 8.5,
    h: 0.45,
    fontSize: 14,
    color: TEXT_DIM,
    align: 'center',
    charSpacing: 3,
  });
  slide.addText(hero, {
    x: 0.6,
    y: 1.55,
    w: 8.8,
    h: 1.6,
    fontSize: 48,
    bold: true,
    color: TEXT_WHITE,
    align: 'center',
  });
  if (bullets.length) {
    const chips = bullets.map((b, i) => ({
      text: b,
      options: { breakLine: i < bullets.length - 1 },
    }));
    slide.addText(chips, {
      x: 0.75,
      y: 3.55,
      w: 8.5,
      h: 1.2,
      fontSize: 14,
      color: TEXT_DIM,
      align: 'center',
    });
  }
  addFooter(slide, index, total);
}

function addChartSlide(slide, pptx, data, index, total) {
  const bullets = bulletsArray(data);
  const parsed = parseTamSamSom(bullets);

  slide.addText(data.title || 'Market Size', {
    x: 0.75,
    y: 0.55,
    w: 8.8,
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: TEXT_WHITE,
  });
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.75,
      y: 1.25,
      w: 8.8,
      h: 0.55,
      fontSize: 16,
      italic: true,
      color: TEXT_DIM,
    });
  }

  if (parsed) {
    const labels = ['TAM', 'SAM', 'SOM'].filter((k) => parsed[k]);
    const values = labels.map((k) => {
      const raw = String(parsed[k]).replace(/[^0-9.]/g, '');
      const n = parseFloat(raw);
      return Number.isFinite(n) && n > 0 ? n : 1;
    });
    slide.addChart(pptx.ChartType.bar, [{ name: 'Market', labels, values }], {
      x: 0.75,
      y: 2.0,
      w: 8.5,
      h: 2.85,
      barDir: 'bar',
      chartColors: [BRAND_INDIGO, BRAND_PURPLE, 'A78BFA'],
      showLegend: false,
      showTitle: false,
      catAxisLabelColor: TEXT_DIM,
      valAxisLabelColor: TEXT_DIM,
      dataLabelColor: TEXT_WHITE,
    });
    labels.forEach((key, i) => {
      slide.addText(`${key}: ${parsed[key]}`, {
        x: 6.2,
        y: 2.15 + i * 0.85,
        w: 3.1,
        h: 0.4,
        fontSize: 14,
        bold: true,
        color: TEXT_WHITE,
        align: 'right',
      });
    });
  } else {
    addBulletsSlide(slide, data, index, total);
    return;
  }
  addFooter(slide, index, total);
}

function addCompetitionSlide(slide, data, index, total) {
  const bullets = bulletsArray(data);
  if (!bullets.length) {
    addBulletsSlide(slide, data, index, total);
    return;
  }

  slide.addText(data.title || 'Competition', {
    x: 0.75,
    y: 0.55,
    w: 8.8,
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: TEXT_WHITE,
  });
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.75,
      y: 1.25,
      w: 8.8,
      h: 0.55,
      fontSize: 16,
      italic: true,
      color: TEXT_DIM,
    });
  }

  let y = 1.95;
  for (const bullet of bullets) {
    const { name, detail } = parseCompetitionRow(bullet);
    slide.addShape('rect', {
      x: 0.75,
      y,
      w: 8.5,
      h: detail ? 0.72 : 0.52,
      fill: { color: 'FFFFFF', transparency: 92 },
      line: { color: 'FFFFFF', transparency: 85 },
    });
    slide.addText(name, {
      x: 0.95,
      y: y + 0.08,
      w: 2.6,
      h: 0.35,
      fontSize: 16,
      bold: true,
      color: TEXT_WHITE,
    });
    if (detail) {
      slide.addText(detail, {
        x: 3.55,
        y: y + 0.08,
        w: 5.5,
        h: 0.5,
        fontSize: 14,
        color: TEXT_DIM,
      });
    }
    y += detail ? 0.82 : 0.62;
  }
  addFooter(slide, index, total);
}

function addCoverSlide(pptx, meta, firstSlide, slideCount) {
  const slide = pptx.addSlide();
  slide.background = {
    color: BRAND_NAVY,
  };
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.5,
    y: -0.5,
    w: 4.5,
    h: 4.5,
    fill: { color: BRAND_INDIGO, transparency: 65 },
    line: { transparency: 100 },
  });
  slide.addText('PITCH SMASHER', {
    x: 0.75,
    y: 0.55,
    w: 4,
    h: 0.35,
    fontSize: 11,
    color: TEXT_DIM,
    charSpacing: 4,
  });
  slide.addText('Investor Pitch Deck', {
    x: 0.75,
    y: 1.55,
    w: 8.5,
    h: 0.45,
    fontSize: 14,
    color: BRAND_INDIGO,
    charSpacing: 3,
  });
  const title = meta.title || firstSlide?.title || 'Investor Pitch Deck';
  slide.addText(title, {
    x: 0.75,
    y: 2.05,
    w: 8.8,
    h: 1.5,
    fontSize: 44,
    bold: true,
    color: TEXT_WHITE,
  });
  const tagline = firstSlide?.subtitle || meta.summary || '';
  if (tagline) {
    slide.addText(tagline, {
      x: 0.75,
      y: 3.55,
      w: 8.5,
      h: 0.9,
      fontSize: 18,
      color: TEXT_DIM,
    });
  }
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  slide.addText(`${date}  •  ${slideCount} slides`, {
    x: 0.75,
    y: 5.1,
    w: 8.5,
    h: 0.35,
    fontSize: 10,
    color: TEXT_DIM,
    transparency: 25,
  });
}

async function renderSlide(pptx, slideData, imageUrl, index, total) {
  const slide = pptx.addSlide();
  await applySlideBackground(slide, pptx, imageUrl);

  const layout = slideData.layout || (index === 0 ? 'title' : 'bullets');
  if (layout === 'title') addTitleSlide(slide, slideData, index, total);
  else if (layout === 'metric') addMetricSlide(slide, slideData, index, total);
  else if (layout === 'chart') addChartSlide(slide, pptx, slideData, index, total);
  else if (layout === 'competition') addCompetitionSlide(slide, slideData, index, total);
  else addBulletsSlide(slide, slideData, index, total);

  if (slideData.speakerNotes) {
    slide.addNotes(String(slideData.speakerNotes).trim());
  }
}

/**
 * Build a pitch deck PPTX buffer from pitchDeck JSON.
 * @param {Array<Object>} pitchDeck
 * @param {{ title?: string, summary?: string }} meta
 * @param {{ imageUrls?: Array<string|null> }} opts
 */
async function buildPitchDeckPptx(pitchDeck, meta = {}, opts = {}) {
  const slides = Array.isArray(pitchDeck) ? pitchDeck : [];
  const imageUrls = Array.isArray(opts.imageUrls) ? opts.imageUrls : [];

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Pitch Smasher';
  pptx.title = meta.title || 'Pitch Smasher Pitch Deck';
  pptx.subject = meta.summary || 'Investor pitch deck';

  if (slides.length) {
    addCoverSlide(pptx, meta, slides[0], slides.length);
    const total = slides.length + 1;
    for (let i = 0; i < slides.length; i++) {
      await renderSlide(pptx, slides[i], imageUrls[i], i + 1, total);
    }
  } else {
    const slide = pptx.addSlide();
    slide.background = { color: BRAND_NAVY };
    slide.addText('Pitch deck', {
      x: 0.75,
      y: 2.2,
      w: 8.5,
      h: 1,
      fontSize: 40,
      bold: true,
      color: TEXT_WHITE,
      align: 'center',
    });
    slide.addText('Slide content was not available when this deck was generated.', {
      x: 1,
      y: 3.2,
      w: 8,
      h: 0.8,
      fontSize: 18,
      color: TEXT_DIM,
      align: 'center',
    });
  }

  return pptx.write({ outputType: 'nodebuffer' });
}

/**
 * Build PPTX and upload to Supabase `exports` bucket.
 */
async function generateAndUploadPitchPptx(pitchDeck, userId, sessionId, meta = {}, opts = {}) {
  try {
    const buffer = await buildPitchDeckPptx(pitchDeck, meta, opts);
    const path = `${userId}/pitch-${sessionId}.pptx`;
    const url = await uploadFile('exports', path, buffer, PPTX_MIME);
    return { url, buffer };
  } catch (err) {
    console.warn('Pitch PPTX export failed:', err.message);
    return { url: null, buffer: null, error: err.message };
  }
}

module.exports = {
  buildPitchDeckPptx,
  generateAndUploadPitchPptx,
  PPTX_MIME,
  parseTamSamSom,
  parseCompetitionRow,
};
