const fs = require('fs');
const { execSync } = require('child_process');
const { uploadFile } = require('./supabase');
const {
  renderPitchDeckHtml,
  renderEmptyDeckHtml,
  embedSlideImages,
} = require('./pitchPdfTemplate');

let cachedBrowser = null;
let cachedPuppeteer = null;
let launching = null;
let cachedExecutablePath; // string | null | undefined ("undefined" = not yet resolved)

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

/**
 * Resolve a usable Chromium executable path. Search order:
 *   1. PUPPETEER_EXECUTABLE_PATH env (only if it actually exists on disk).
 *   2. Common system install paths (apt-installed Debian/Ubuntu).
 *   3. `which`/`where` lookups for chromium / chromium-browser / google-chrome.
 *      This finds Nix-installed binaries on Railway/Nixpacks, where chromium
 *      lives under the nix store and is on $PATH.
 *   4. null - fall back to puppeteer's bundled Chromium when download was kept.
 */
function resolveChromiumPath() {
  if (cachedExecutablePath !== undefined) return cachedExecutablePath;

  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fromEnv.trim()) {
    if (fs.existsSync(fromEnv)) {
      cachedExecutablePath = fromEnv;
      return cachedExecutablePath;
    }
    console.warn(
      `PUPPETEER_EXECUTABLE_PATH="${fromEnv}" does not exist on disk; falling back to PATH lookup.`
    );
  }

  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        cachedExecutablePath = p;
        return cachedExecutablePath;
      }
    } catch {
      // ignore
    }
  }

  const isWindows = process.platform === 'win32';
  const lookupCmd = isWindows ? 'where' : 'which';
  const names = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
  for (const name of names) {
    try {
      const out = execSync(`${lookupCmd} ${name}`, {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim()
        .split(/\r?\n/)[0];
      if (out && fs.existsSync(out)) {
        cachedExecutablePath = out;
        return cachedExecutablePath;
      }
    } catch {
      // not found, try next
    }
  }

  cachedExecutablePath = null;
  return cachedExecutablePath;
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
  const executablePath = resolveChromiumPath();
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }
  console.log(
    `Launching headless Chromium for pitch PDF (executablePath=${executablePath || 'puppeteer-bundled'}).`
  );

  launching = puppeteer
    .launch(launchOptions)
    .then((browser) => {
      cachedBrowser = browser;
      launching = null;
      browser.on('disconnected', () => {
        if (cachedBrowser === browser) cachedBrowser = null;
      });
      return browser;
    })
    .catch((err) => {
      launching = null;
      const hint = executablePath
        ? `executablePath="${executablePath}"`
        : 'no executablePath set (puppeteer-bundled Chromium)';
      const wrapped = new Error(
        `Failed to launch headless Chromium (${hint}): ${err.message}. ` +
          `Ensure chromium is installed (Railway/Nixpacks: nixPkgs = ["...","chromium"]) ` +
          `and that PUPPETEER_EXECUTABLE_PATH points to an existing binary or is unset.`
      );
      wrapped.cause = err;
      throw wrapped;
    });

  return launching;
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
  resolveChromiumPath,
};
