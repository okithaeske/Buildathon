const { uploadFile } = require('./supabase');
const {
  renderPitchDeckHtml,
  renderEmptyDeckHtml,
  embedSlideImages,
} = require('./pitchPdfTemplate');

let cachedBrowser = null;
let cachedPuppeteer = null;
let launching = null;

function loadPuppeteer() {
  if (cachedPuppeteer) return cachedPuppeteer;
  try {
    cachedPuppeteer = require('puppeteer');
  } catch (err) {
    throw new Error(
      `puppeteer is not installed. Run "npm install puppeteer" in launchpad-backend. (${err.message})`
    );
  }
  return cachedPuppeteer;
}

async function getBrowser() {
  if (cachedBrowser && cachedBrowser.isConnected()) return cachedBrowser;
  if (launching) return launching;

  const puppeteer = loadPuppeteer();
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=medium',
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  launching = puppeteer.launch(launchOptions).then((browser) => {
    cachedBrowser = browser;
    launching = null;
    browser.on('disconnected', () => {
      if (cachedBrowser === browser) cachedBrowser = null;
    });
    return browser;
  });

  try {
    return await launching;
  } catch (err) {
    launching = null;
    throw err;
  }
}

async function shutdownBrowser() {
  const browser = cachedBrowser;
  cachedBrowser = null;
  if (browser) {
    try {
      await browser.close();
    } catch (err) {
      console.warn('Puppeteer shutdown warning:', err.message);
    }
  }
}

/**
 * Build a content-rich pitch deck PDF buffer from pitchDeck JSON.
 * @param {Array<Object>} pitchDeck
 * @param {{ title?: string, summary?: string }} [meta]
 * @param {{ imageUrls?: Array<string|null>, citations?: string[] }} [opts]
 * @returns {Promise<Buffer>}
 */
async function buildPitchDeckPdf(pitchDeck, meta = {}, opts = {}) {
  const slides = Array.isArray(pitchDeck) ? pitchDeck : [];
  const imageUrls = Array.isArray(opts.imageUrls) ? opts.imageUrls : [];

  const html = slides.length
    ? renderPitchDeckHtml(slides, meta, {
        slideImages: await embedSlideImages(imageUrls.slice(0, slides.length)),
        citations: opts.citations || [],
      })
    : renderEmptyDeckHtml(meta);

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdf = await page.pdf({
      width: '13.333in',
      height: '7.5in',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Build the deck PDF and upload to Supabase `exports` bucket.
 * @returns {Promise<string|null>} public URL, or null if generation failed
 */
async function generateAndUploadPitchPdf(pitchDeck, userId, sessionId, meta = {}, opts = {}) {
  try {
    const buffer = await buildPitchDeckPdf(pitchDeck, meta, opts);
    const path = `${userId}/pitch-${sessionId}.pdf`;
    return await uploadFile('exports', path, buffer, 'application/pdf');
  } catch (err) {
    console.warn('Pitch PDF export failed:', err.message);
    return null;
  }
}

module.exports = {
  buildPitchDeckPdf,
  generateAndUploadPitchPdf,
  shutdownBrowser,
};
