const fs = require('fs');
const path = require('path');
const os = require('os');
const { isMock } = require('../utils/mock');

const BASE_URL = 'https://api.minimax.chat/v1';

function getTempDir() {
  const dir = process.env.TEMP_DIR || path.join(os.tmpdir(), 'launchpad');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function chatComplete(system, user, opts = {}) {
  if (isMock()) {
    return JSON.stringify(opts.mockResponse ?? { message: 'Mock LLM response' });
  }

  const res = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model || 'MiniMax-M2.7',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opts.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MiniMax chat error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content =
    data.choices?.[0]?.message?.content ??
    data.reply ??
    data.base_resp?.status_msg;
  if (!content) throw new Error('MiniMax returned empty response');
  return typeof content === 'string' ? content : JSON.stringify(content);
}

async function textToSpeech(text, voice = 'female-yujia') {
  const outPath = path.join(getTempDir(), `tts-${Date.now()}.mp3`);

  if (isMock()) {
    fs.writeFileSync(outPath, Buffer.alloc(0));
    return outPath;
  }

  const res = await fetch(`${BASE_URL}/t2a_v2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'speech-2.8',
      text,
      voice_setting: { voice_id: voice },
      audio_setting: { format: 'mp3' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MiniMax TTS error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const audioHex = data.data?.audio ?? data.audio;
  if (audioHex) {
    fs.writeFileSync(outPath, Buffer.from(audioHex, 'hex'));
    return outPath;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

async function generateMusic(mood = 'confident', duration = 30) {
  const outPath = path.join(getTempDir(), `music-${Date.now()}.mp3`);

  if (isMock()) {
    fs.writeFileSync(outPath, Buffer.alloc(0));
    return outPath;
  }

  const res = await fetch(`${BASE_URL}/music_generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'music-2.6',
      prompt: `${mood} background music for a startup pitch, instrumental`,
      duration,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MiniMax music error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const audioHex = data.data?.audio ?? data.audio;
  if (audioHex) {
    fs.writeFileSync(outPath, Buffer.from(audioHex, 'hex'));
    return outPath;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

async function generateVideo(prompt) {
  if (isMock()) return null;

  try {
    const res = await fetch(`${BASE_URL}/video_generation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'hailuo-2.3',
        prompt,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.video_url ?? data.data?.video_url ?? null;
  } catch {
    return null;
  }
}

module.exports = { chatComplete, textToSpeech, generateMusic, generateVideo, getTempDir };
