const { isMockAi } = require('../utils/config');
const { uploadFile } = require('./supabase');

function parseSize(size = '1200x630') {
  const [w, h] = size.split('x').map(Number);
  return { width: w || 1200, height: h || 630 };
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

/**
 * Generate banner and persist to Supabase Storage when userId provided.
 */
async function generateImage(prompt, size = '1200x630', options = {}) {
  if (isMockAi()) {
    throw new Error('Image generation disabled when MOCK_AI=true');
  }

  const provider =
    process.env.IMAGE_PROVIDER ||
    (process.env.OPENAI_API_KEY ? 'openai' : 'pollinations');

  let sourceUrl;
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required for openai provider');
    sourceUrl = await generateWithOpenAI(prompt, size);
  } else if (provider === 'placeholder') {
    sourceUrl = `https://placehold.co/1200x630/png?text=${encodeURIComponent(prompt.slice(0, 40))}`;
  } else {
    sourceUrl = pollinationsUrl(prompt, size);
  }

  const { userId, storagePath } = options;
  if (!userId || process.env.UPLOAD_IMAGES_TO_STORAGE === 'false') {
    return sourceUrl;
  }

  try {
    const buffer = await fetchImageBuffer(sourceUrl);
    const path = storagePath || `${userId}/banner-${Date.now()}.png`;
    return await uploadFile('images', path, buffer, 'image/png');
  } catch (err) {
    console.warn('Banner storage upload failed, using source URL:', err.message);
    return sourceUrl;
  }
}

module.exports = { generateImage, pollinationsUrl, fetchImageBuffer };
