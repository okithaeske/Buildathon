const { fetchImageBuffer } = require('./images');

const BRAND_NAVY = '#1A1A2E';
const BRAND_INDIGO = '#6366F1';
const BRAND_PURPLE = '#8B5CF6';
const TEXT_WHITE = '#FFFFFF';
const TEXT_DIM = '#E8E8F2';
const TEXT_MUTED = 'rgba(232, 232, 242, 0.72)';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function toEmbeddableImage(imageUrl) {
  if (!imageUrl) return null;
  if (typeof imageUrl !== 'string') return null;
  if (imageUrl.startsWith('data:')) return imageUrl;
  try {
    const buffer = await fetchImageBuffer(imageUrl);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.warn('PDF slide image fetch failed:', err.message);
    return null;
  }
}

async function embedSlideImages(imageUrls = []) {
  return Promise.all(imageUrls.map((url) => toEmbeddableImage(url)));
}

function bulletsArray(slide) {
  return Array.isArray(slide.bullets) ? slide.bullets.map((b) => String(b).trim()).filter(Boolean) : [];
}

/**
 * Parse "TAM: $500M", "SAM: 80M", etc. Returns ordered array or null.
 */
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

/**
 * Split "LearnX Lanka — local but no AI" into { name, detail }.
 */
function parseCompetitionRow(bullet) {
  const text = String(bullet).trim();
  const m = text.match(/^(.+?)\s*[—–\-:|]\s*(.+)$/);
  if (m) return { name: m[1].trim(), detail: m[2].trim() };
  return { name: text, detail: '' };
}

function backgroundLayer(imageData) {
  if (!imageData) return '';
  return `
    <div class="bg-image" style="background-image: url('${escapeAttr(imageData)}')"></div>
    <div class="bg-overlay"></div>
  `;
}

function footerLayer(index, total) {
  const left = `LaunchPad AI`;
  const right = `${index + 1} / ${total}`;
  return `
    <div class="footer">
      <span>${escapeHtml(left)}</span>
      <span>${escapeHtml(right)}</span>
    </div>
  `;
}

function renderTitleSlide(slide) {
  const subtitle = slide.subtitle || slide.content || '';
  return `
    <div class="content title-layout">
      <h1 class="hero-title">${escapeHtml(slide.title || 'Pitch')}</h1>
      ${subtitle ? `<p class="hero-subtitle">${escapeHtml(subtitle)}</p>` : ''}
    </div>
  `;
}

function renderBulletSlide(slide) {
  const bullets = bulletsArray(slide);
  return `
    <div class="content bullets-layout">
      <h2 class="slide-title">${escapeHtml(slide.title || '')}</h2>
      ${slide.subtitle ? `<p class="slide-subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
      ${
        bullets.length
          ? `<ul class="bullet-list">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
          : slide.content
            ? `<p class="slide-body">${escapeHtml(slide.content)}</p>`
            : ''
      }
    </div>
  `;
}

function renderMetricSlide(slide) {
  const bullets = bulletsArray(slide);
  const hero = slide.subtitle || slide.content || '';
  return `
    <div class="content metric-layout">
      <p class="metric-eyebrow">${escapeHtml(slide.title || '')}</p>
      <p class="metric-hero">${escapeHtml(hero)}</p>
      ${
        bullets.length
          ? `<div class="metric-support">${bullets
              .map((b) => `<span class="metric-chip">${escapeHtml(b)}</span>`)
              .join('')}</div>`
          : ''
      }
    </div>
  `;
}

function renderChartSlide(slide) {
  const bullets = bulletsArray(slide);
  const parsed = parseTamSamSom(bullets);

  if (!parsed) {
    return renderBulletSlide(slide);
  }

  const rows = ['TAM', 'SAM', 'SOM']
    .map((key, i) => {
      const value = parsed[key];
      if (!value) return '';
      const widths = [100, 62, 28];
      return `
        <div class="chart-row">
          <div class="chart-label">${key}</div>
          <div class="chart-bar"><div class="chart-fill" style="width: ${widths[i]}%"></div></div>
          <div class="chart-value">${escapeHtml(value)}</div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="content chart-layout">
      <h2 class="slide-title">${escapeHtml(slide.title || 'Market Size')}</h2>
      ${slide.subtitle ? `<p class="slide-subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
      <div class="chart">${rows}</div>
    </div>
  `;
}

function renderCompetitionSlide(slide) {
  const bullets = bulletsArray(slide);
  if (!bullets.length) return renderBulletSlide(slide);

  const rows = bullets
    .map((b) => {
      const { name, detail } = parseCompetitionRow(b);
      return `
        <div class="comp-row">
          <div class="comp-name">${escapeHtml(name)}</div>
          <div class="comp-detail">${escapeHtml(detail)}</div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="content competition-layout">
      <h2 class="slide-title">${escapeHtml(slide.title || 'Competition')}</h2>
      ${slide.subtitle ? `<p class="slide-subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
      <div class="comp-grid">${rows}</div>
    </div>
  `;
}

function renderSlide(slide, imageData, index, total) {
  const layout = slide.layout || (index === 0 ? 'title' : 'bullets');
  let body;
  if (layout === 'title') body = renderTitleSlide(slide);
  else if (layout === 'metric') body = renderMetricSlide(slide);
  else if (layout === 'chart') body = renderChartSlide(slide);
  else if (layout === 'competition') body = renderCompetitionSlide(slide);
  else body = renderBulletSlide(slide);

  return `
    <section class="slide layout-${escapeAttr(layout)}">
      ${backgroundLayer(imageData)}
      ${body}
      ${footerLayer(index, total)}
    </section>
  `;
}

function renderCoverSlide(meta, firstSlide, totalSlides) {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const title = meta.title || firstSlide?.title || 'Investor Pitch Deck';
  const tagline = firstSlide?.subtitle || meta.summary || '';
  return `
    <section class="slide cover">
      <div class="cover-mark">LaunchPad AI</div>
      <div class="cover-body">
        <p class="cover-eyebrow">Investor Pitch Deck</p>
        <h1 class="cover-title">${escapeHtml(title)}</h1>
        ${tagline ? `<p class="cover-tagline">${escapeHtml(tagline)}</p>` : ''}
      </div>
      <div class="cover-meta">
        <span>${escapeHtml(date)}</span>
        <span>${totalSlides} slides</span>
      </div>
    </section>
  `;
}

function renderCitationsSlide(citations, total, index) {
  const items = citations
    .slice(0, 18)
    .map((url) => `<li><a href="${escapeAttr(url)}">${escapeHtml(url)}</a></li>`)
    .join('');
  return `
    <section class="slide citations">
      <div class="content">
        <h2 class="slide-title">Sources &amp; citations</h2>
        <ol class="citation-list">${items}</ol>
      </div>
      ${footerLayer(index, total)}
    </section>
  `;
}

function renderNotesAppendix(slides) {
  if (!slides.length) return '';
  const intro = `
    <section class="appendix-divider">
      <div>
        <p class="appendix-eyebrow">Appendix</p>
        <h2 class="appendix-title">Presenter notes</h2>
        <p class="appendix-sub">Speaker script for each slide. Hidden during the live deck view.</p>
      </div>
    </section>
  `;
  const pages = slides
    .map((slide, i) => {
      const notes = slide.speakerNotes
        ? String(slide.speakerNotes).trim()
        : 'No speaker notes provided for this slide.';
      const bullets = bulletsArray(slide);
      return `
        <section class="notes-page">
          <div class="notes-header">
            <span class="notes-index">Slide ${i + 1}</span>
            <span class="notes-layout">${escapeHtml(slide.layout || 'bullets')}</span>
          </div>
          <h3 class="notes-title">${escapeHtml(slide.title || '')}</h3>
          ${slide.subtitle ? `<p class="notes-subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
          <p class="notes-body">${escapeHtml(notes)}</p>
          ${
            bullets.length
              ? `<div class="notes-bullets">
                  <p class="notes-bullets-label">On-slide bullets</p>
                  <ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
                </div>`
              : ''
          }
        </section>
      `;
    })
    .join('');
  return intro + pages;
}

function buildStyles() {
  return `
    @page { size: 13.333in 7.5in; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif;
      color: ${TEXT_WHITE};
      background: ${BRAND_NAVY};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .slide {
      position: relative;
      width: 13.333in;
      height: 7.5in;
      overflow: hidden;
      page-break-after: always;
      background: ${BRAND_NAVY};
      display: flex;
      flex-direction: column;
    }
    .slide::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 0.18in;
      background: linear-gradient(180deg, ${BRAND_INDIGO}, ${BRAND_PURPLE});
    }
    .bg-image {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
    }
    .bg-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(26, 26, 46, 0.78), rgba(26, 26, 46, 0.55));
    }
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      padding: 0.85in 0.95in 0.7in;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .footer {
      position: absolute;
      left: 0.95in;
      right: 0.95in;
      bottom: 0.35in;
      display: flex;
      justify-content: space-between;
      font-size: 11pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: ${TEXT_MUTED};
      z-index: 2;
    }

    /* Title slide */
    .title-layout { align-items: center; justify-content: center; text-align: center; }
    .hero-title {
      font-size: 64pt;
      font-weight: 800;
      line-height: 1.04;
      margin: 0 0 0.2in;
      letter-spacing: -0.02em;
      max-width: 11in;
    }
    .hero-subtitle {
      font-size: 22pt;
      font-weight: 400;
      color: ${TEXT_DIM};
      max-width: 9in;
      margin: 0;
      line-height: 1.35;
    }

    /* Generic */
    .slide-title {
      font-size: 38pt;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin: 0 0 0.18in;
      line-height: 1.1;
    }
    .slide-subtitle {
      font-size: 18pt;
      color: ${TEXT_DIM};
      margin: 0 0 0.3in;
      font-style: italic;
      max-width: 10in;
    }
    .slide-body {
      font-size: 20pt;
      line-height: 1.45;
      color: ${TEXT_WHITE};
      max-width: 10.5in;
    }

    /* Bullets */
    .bullet-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.18in;
      max-width: 10.5in;
    }
    .bullet-list li {
      position: relative;
      padding-left: 0.5in;
      font-size: 22pt;
      line-height: 1.35;
      color: ${TEXT_WHITE};
    }
    .bullet-list li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.18in;
      width: 0.22in;
      height: 0.22in;
      border-radius: 50%;
      background: ${BRAND_INDIGO};
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.18);
    }

    /* Metric */
    .metric-layout { align-items: center; text-align: center; justify-content: center; }
    .metric-eyebrow {
      font-size: 16pt;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${TEXT_DIM};
      margin: 0 0 0.35in;
    }
    .metric-hero {
      font-size: 72pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.04;
      margin: 0 0 0.4in;
      max-width: 11in;
    }
    .metric-support {
      display: flex;
      justify-content: center;
      gap: 0.25in;
      flex-wrap: wrap;
    }
    .metric-chip {
      display: inline-block;
      padding: 0.15in 0.35in;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      font-size: 14pt;
      color: ${TEXT_DIM};
      background: rgba(255, 255, 255, 0.05);
    }

    /* Chart */
    .chart {
      display: flex;
      flex-direction: column;
      gap: 0.32in;
      margin-top: 0.15in;
      max-width: 11in;
    }
    .chart-row {
      display: grid;
      grid-template-columns: 1.1in 1fr 2.4in;
      align-items: center;
      gap: 0.3in;
    }
    .chart-label {
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: ${TEXT_DIM};
    }
    .chart-bar {
      height: 0.5in;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }
    .chart-fill {
      height: 100%;
      background: linear-gradient(90deg, ${BRAND_INDIGO}, ${BRAND_PURPLE});
      border-radius: 999px;
    }
    .chart-value {
      font-size: 22pt;
      font-weight: 700;
      color: ${TEXT_WHITE};
    }

    /* Competition */
    .comp-grid {
      display: flex;
      flex-direction: column;
      gap: 0.18in;
      max-width: 11in;
    }
    .comp-row {
      display: grid;
      grid-template-columns: 3in 1fr;
      gap: 0.35in;
      padding: 0.22in 0.3in;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 0.18in;
      background: rgba(255, 255, 255, 0.04);
    }
    .comp-name {
      font-size: 20pt;
      font-weight: 700;
      color: ${TEXT_WHITE};
    }
    .comp-detail {
      font-size: 18pt;
      color: ${TEXT_DIM};
      line-height: 1.35;
    }

    /* Cover */
    .cover {
      padding: 0.95in 1in;
      justify-content: space-between;
      background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.35), transparent 55%), ${BRAND_NAVY};
    }
    .cover-mark {
      position: relative;
      z-index: 1;
      font-size: 14pt;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: ${TEXT_DIM};
    }
    .cover-body { position: relative; z-index: 1; max-width: 11in; }
    .cover-eyebrow {
      font-size: 14pt;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: ${BRAND_INDIGO};
      margin: 0 0 0.25in;
    }
    .cover-title {
      font-size: 72pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.02;
      margin: 0 0 0.3in;
    }
    .cover-tagline {
      font-size: 22pt;
      line-height: 1.35;
      color: ${TEXT_DIM};
      margin: 0;
      max-width: 10in;
    }
    .cover-meta {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      font-size: 12pt;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${TEXT_MUTED};
    }

    /* Citations */
    .citations .content { padding-top: 0.8in; }
    .citation-list {
      margin: 0;
      padding-left: 0.45in;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.12in 0.6in;
      max-width: 11.4in;
    }
    .citation-list li {
      font-size: 12pt;
      line-height: 1.35;
      color: ${TEXT_DIM};
      word-break: break-all;
    }
    .citation-list a { color: ${TEXT_DIM}; text-decoration: none; }

    /* Appendix */
    .appendix-divider {
      width: 13.333in;
      height: 7.5in;
      page-break-after: always;
      background: linear-gradient(135deg, ${BRAND_INDIGO}, ${BRAND_PURPLE});
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 1.5in;
      text-align: center;
    }
    .appendix-eyebrow {
      font-size: 14pt;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.78);
      margin: 0 0 0.2in;
    }
    .appendix-title {
      font-size: 60pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 0.25in;
    }
    .appendix-sub {
      font-size: 18pt;
      color: rgba(255, 255, 255, 0.85);
      margin: 0;
      max-width: 9in;
      line-height: 1.4;
    }
    .notes-page {
      width: 13.333in;
      height: 7.5in;
      padding: 0.85in 1in;
      page-break-after: always;
      background: #FFFFFF;
      color: #14142B;
      display: flex;
      flex-direction: column;
      gap: 0.18in;
    }
    .notes-page:last-child { page-break-after: auto; }
    .notes-header {
      display: flex;
      justify-content: space-between;
      font-size: 11pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(20, 20, 43, 0.55);
    }
    .notes-title {
      font-size: 32pt;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.1;
      margin: 0;
      color: ${BRAND_NAVY};
    }
    .notes-subtitle {
      font-size: 16pt;
      color: rgba(20, 20, 43, 0.62);
      margin: 0;
      font-style: italic;
    }
    .notes-body {
      font-size: 15pt;
      line-height: 1.55;
      margin: 0.05in 0 0;
      color: rgba(20, 20, 43, 0.85);
      max-width: 10.5in;
    }
    .notes-bullets {
      margin-top: auto;
      padding-top: 0.25in;
      border-top: 1px solid rgba(20, 20, 43, 0.1);
    }
    .notes-bullets-label {
      font-size: 10pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(20, 20, 43, 0.5);
      margin: 0 0 0.1in;
    }
    .notes-bullets ul {
      margin: 0;
      padding-left: 0.3in;
      display: flex;
      flex-direction: column;
      gap: 0.06in;
    }
    .notes-bullets li {
      font-size: 12pt;
      color: rgba(20, 20, 43, 0.78);
      line-height: 1.4;
    }
  `;
}

/**
 * Build the full HTML document for a pitch deck PDF.
 * @param {Array<Object>} pitchDeck
 * @param {{ title?: string, summary?: string }} meta
 * @param {{ slideImages?: Array<string|null>, citations?: string[] }} opts
 */
function renderPitchDeckHtml(pitchDeck, meta = {}, opts = {}) {
  const slides = Array.isArray(pitchDeck) ? pitchDeck : [];
  const slideImages = Array.isArray(opts.slideImages) ? opts.slideImages : [];
  const citations = Array.isArray(opts.citations)
    ? opts.citations.filter((c) => typeof c === 'string' && c.trim())
    : [];

  const total = slides.length + 1 + (citations.length ? 1 : 0);
  const cover = renderCoverSlide(meta, slides[0], slides.length);
  const slideHtml = slides
    .map((s, i) => renderSlide(s, slideImages[i], i + 1, total))
    .join('');
  const citationsHtml = citations.length
    ? renderCitationsSlide(citations, total, slides.length + 1)
    : '';
  const notesHtml = renderNotesAppendix(slides);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(meta.title || 'LaunchPad AI Pitch Deck')}</title>
    <style>${buildStyles()}</style>
  </head>
  <body>
    ${cover}
    ${slideHtml}
    ${citationsHtml}
    ${notesHtml}
  </body>
</html>`;
}

function renderEmptyDeckHtml(meta = {}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(meta.title || 'LaunchPad AI Pitch Deck')}</title>
    <style>${buildStyles()}</style>
  </head>
  <body>
    <section class="slide title-layout">
      <div class="content title-layout">
        <h1 class="hero-title">Pitch deck</h1>
        <p class="hero-subtitle">Slide content was not available when this deck was generated.</p>
      </div>
    </section>
  </body>
</html>`;
}

module.exports = {
  renderPitchDeckHtml,
  renderEmptyDeckHtml,
  embedSlideImages,
  parseTamSamSom,
  parseCompetitionRow,
};
