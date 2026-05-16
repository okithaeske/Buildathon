const { isMockAi } = require('../utils/config');
const { uploadFile } = require('./supabase');
const { generateImageBuffer } = require('./minimax');

function parseSize(size = '1200x630') {
  const [w, h] = size.split('x').map(Number);
  return { width: w || 1200, height: h || 630 };
}

function sizeToAspectRatio(size) {
  const { width, height } = parseSize(size);
  const ratio = width / height;
  if (ratio >= 1.7) return '16:9';
  if (ratio >= 1.2) return '4:3';
  if (ratio >= 0.9) return '1:1';
  if (ratio >= 0.65) return '3:4';
  return '9:16';
}

function pollinationsUrl(prompt, size) {
  const { width, height } = parseSize(size);
  const encoded = encodeURIComponent(prompt.slice(0, 500));
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true`;
}

async function generateWithOpenAI(prompt, size) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: size === '1200x630' ? '1792x1024' : size,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI image error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.data[0].url;
}

async function fetchImageBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function resolveProvider() {
  if (process.env.IMAGE_PROVIDER) return process.env.IMAGE_PROVIDER;
  if (process.env.MINIMAX_API_KEY) return 'minimax';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'pollinations';
}

/**
 * Generate campaign banner and persist to Supabase Storage when userId provided.
 * Providers: minimax (default if MINIMAX_API_KEY set) | pollinations | openai | placeholder
 */
async function generateImage(prompt, size = '1200x630', options = {}) {
  if (isMockAi()) {
    throw new Error('Image generation disabled when MOCK_AI=true');
  }

  const provider = resolveProvider();
  const { userId, storagePath, subjectReferenceUrl } = options;
  let buffer = null;
  let sourceUrl = null;

  if (provider === 'minimax') {
    buffer = await generateImageBuffer(prompt, sizeToAspectRatio(size), {
      subjectReferenceUrl,
      promptOptimizer: process.env.MINIMAX_IMAGE_PROMPT_OPTIMIZER === 'true',
    });
  } else if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required for openai provider');
    sourceUrl = await generateWithOpenAI(prompt, size);
  } else if (provider === 'placeholder') {
    sourceUrl = `https://placehold.co/1200x630/png?text=${encodeURIComponent(prompt.slice(0, 40))}`;
  } else {
    sourceUrl = pollinationsUrl(prompt, size);
  }

  if (!buffer && sourceUrl) {
    buffer = await fetchImageBuffer(sourceUrl);
  }

  if (userId && buffer && process.env.UPLOAD_IMAGES_TO_STORAGE !== 'false') {
    try {
      const path = storagePath || `${userId}/banner-${Date.now()}.jpeg`;
      return await uploadFile('images', path, buffer, 'image/jpeg');
    } catch (err) {
      console.warn('Banner storage upload failed:', err.message);
    }
  }

  if (buffer) {
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }

  return sourceUrl;
}

module.exports = { generateImage, resolveProvider, pollinationsUrl, fetchImageBuffer };
