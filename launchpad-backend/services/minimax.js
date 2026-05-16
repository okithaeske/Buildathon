const fs = require('fs');
const path = require('path');
const os = require('os');
const { isMockAi } = require('../utils/config');

const BASE_URL = (process.env.MINIMAX_API_BASE || 'https://api.minimax.io').replace(/\/$/, '');

function getTempDir() {
  const dir = process.env.TEMP_DIR || path.join(os.tmpdir(), 'launchpad');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function apiUrl(pathSegment, query = {}) {
  const url = new URL(`${BASE_URL}${pathSegment}`);
  if (process.env.MINIMAX_GROUP_ID) {
    query.GroupId = process.env.MINIMAX_GROUP_ID;
  }
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

function minimaxHeaders() {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error('MINIMAX_API_KEY is not set');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function assertMiniMaxOk(data, context) {
  const code = data?.base_resp?.status_code;
  if (code !== undefined && code !== 0) {
    throw new Error(`MiniMax ${context}: ${data.base_resp.status_msg || code}`);
  }
}

async function chatComplete(system, user, opts = {}) {
  if (isMockAi()) {
    return JSON.stringify(opts.mockResponse ?? { message: 'Mock LLM response' });
  }

  const res = await fetch(apiUrl('/v1/text/chatcompletion_v2'), {
    method: 'POST',
    headers: minimaxHeaders(),
    body: JSON.stringify({
      model: opts.model || 'MiniMax-M2.7',
      messages: [
        { role: 'system', name: 'MiniMax AI', content: system },
        { role: 'user', name: 'user', content: user },
      ],
      temperature: opts.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiniMax chat error: ${res.status} ${text}`);
  }

  const data = await res.json();
  assertMiniMaxOk(data, 'chat');

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('MiniMax returned empty chat response');
  return typeof content === 'string' ? content : JSON.stringify(content);
}

async function generateMusic(mood = 'confident') {
  const outPath = path.join(getTempDir(), `music-${Date.now()}.mp3`);

  if (isMockAi()) {
    throw new Error('Music generation unavailable in MOCK_AI mode');
  }

  const res = await fetch(apiUrl('/v1/music_generation'), {
    method: 'POST',
    headers: minimaxHeaders(),
    body: JSON.stringify({
      model: 'music-2.6',
      prompt: `${mood} instrumental background music for a startup pitch, cinematic, no vocals`,
      is_instrumental: true,
      stream: false,
      output_format: 'hex',
      audio_setting: { sample_rate: 44100, bitrate: 128000, format: 'mp3' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MiniMax music error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  assertMiniMaxOk(data, 'music');

  const audioHex = data.data?.audio ?? data.audio;
  if (audioHex) {
    fs.writeFileSync(outPath, Buffer.from(audioHex, 'hex'));
    return outPath;
  }

  throw new Error('MiniMax music returned no audio data');
}

async function generateVideo(prompt) {
  if (isMockAi()) return null;

  try {
    const res = await fetch(apiUrl('/v1/video_generation'), {
      method: 'POST',
      headers: minimaxHeaders(),
      body: JSON.stringify({
        model: 'video-01',
        prompt: prompt.slice(0, 500),
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    assertMiniMaxOk(data, 'video');
    return data.video_url ?? data.data?.video_url ?? data.file?.download_url ?? null;
  } catch (err) {
    console.warn('Video generation skipped:', err.message);
    return null;
  }
}

/**
 * Text-to-image (or image-to-image with subject_reference) via MiniMax image-01.
 * @param {object} [options]
 * @param {string} [options.subjectReferenceUrl] Public URL for subject_reference
 * @param {boolean} [options.promptOptimizer] Enable MiniMax prompt_optimizer
 * @returns {Buffer} JPEG/PNG image bytes
 */
async function generateImageBuffer(prompt, aspectRatio = '16:9', options = {}) {
  if (isMockAi()) {
    throw new Error('Image generation disabled when MOCK_AI=true');
  }

  const body = {
    model: 'image-01',
    prompt: prompt.slice(0, 1500),
    aspect_ratio: aspectRatio,
    n: 1,
    response_format: 'base64',
  };

  if (options.promptOptimizer) body.prompt_optimizer = true;

  if (options.subjectReferenceUrl) {
    body.subject_reference = [
      {
        type: 'character',
        image_file: options.subjectReferenceUrl,
      },
    ];
  }

  const res = await fetch(apiUrl('/v1/image_generation'), {
    method: 'POST',
    headers: minimaxHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiniMax image error: ${res.status} ${text}`);
  }

  const data = await res.json();
  assertMiniMaxOk(data, 'image');

  const images = data.data?.image_base64 ?? data.image_base64;
  if (!images?.length) throw new Error('MiniMax image returned no data');
  return Buffer.from(images[0], 'base64');
}

module.exports = {
  chatComplete,
  generateMusic,
  generateVideo,
  generateImageBuffer,
  getTempDir,
};
