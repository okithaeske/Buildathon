const fs = require('fs');
const path = require('path');
const { isMockAi } = require('../utils/config');
const { getTempDir } = require('./minimax');

const MINIMAX_BASE = (process.env.MINIMAX_API_BASE || 'https://api.minimax.io').replace(/\/$/, '');

const OPENAI_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

function getTtsMaxChars() {
  const key =
    resolveProvider() === 'openai' ? 'OPENAI_TTS_MAX_CHARS' : 'MINIMAX_TTS_MAX_CHARS';
  const fallback = resolveProvider() === 'openai' ? '4096' : '1500';
  const n = parseInt(process.env[key] || fallback, 10);
  const cap = resolveProvider() === 'openai' ? 4096 : 10000;
  return Number.isFinite(n) && n > 0 ? Math.min(n, cap) : parseInt(fallback, 10);
}

function resolveProvider() {
  if (process.env.TTS_PROVIDER) return process.env.TTS_PROVIDER;
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  if (process.env.MINIMAX_API_KEY?.trim()) return 'minimax';
  return 'minimax';
}

function minimaxApiUrl(pathSegment) {
  const url = new URL(`${MINIMAX_BASE}${pathSegment}`);
  if (process.env.MINIMAX_GROUP_ID) {
    url.searchParams.set('GroupId', process.env.MINIMAX_GROUP_ID);
  }
  return url.toString();
}

function openaiVoice(voiceHint) {
  const configured = process.env.OPENAI_TTS_VOICE?.trim();
  if (configured && OPENAI_VOICES.has(configured)) return configured;
  if (typeof voiceHint === 'string' && OPENAI_VOICES.has(voiceHint)) return voiceHint;
  return 'nova';
}

async function textToSpeechMiniMax(text, voice = 'English_expressive_narrator') {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY is not set');

  const outPath = path.join(getTempDir(), `tts-minimax-${Date.now()}.mp3`);
  const maxChars = getTtsMaxChars();

  const res = await fetch(minimaxApiUrl('/v1/t2a_v2'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'speech-2.8-hd',
      text: text.slice(0, maxChars),
      stream: false,
      output_format: 'hex',
      voice_setting: { voice_id: voice, speed: 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MiniMax TTS error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const code = data?.base_resp?.status_code;
  if (code !== undefined && code !== 0) {
    throw new Error(`MiniMax TTS: ${data.base_resp?.status_msg || code}`);
  }

  const audioHex = data.data?.audio;
  if (!audioHex) throw new Error('MiniMax TTS returned no audio data');
  fs.writeFileSync(outPath, Buffer.from(audioHex, 'hex'));
  return outPath;
}

async function textToSpeechOpenAI(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const outPath = path.join(getTempDir(), `tts-openai-${Date.now()}.mp3`);
  const maxChars = getTtsMaxChars();
  const model = process.env.OPENAI_TTS_MODEL || 'tts-1-hd';

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, maxChars),
      voice: openaiVoice(),
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI TTS error: ${res.status} ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new Error('OpenAI TTS returned empty audio');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

/**
 * Text-to-speech for pitch audio, campaign ad script, refine questions.
 * Provider: openai (recommended) | minimax
 * Falls back to the other provider if configured and primary fails.
 */
async function textToSpeech(text, voice) {
  if (isMockAi()) {
    throw new Error('TTS unavailable in MOCK_AI mode — set MOCK_AI=false for production');
  }

  const provider = resolveProvider();
  const run =
    provider === 'openai'
      ? () => textToSpeechOpenAI(text)
      : () => textToSpeechMiniMax(text, voice);

  try {
    return await run();
  } catch (primaryErr) {
    if (provider === 'openai' && process.env.MINIMAX_API_KEY?.trim()) {
      console.warn('OpenAI TTS failed, trying MiniMax:', primaryErr.message);
      return textToSpeechMiniMax(text, voice);
    }
    if (provider === 'minimax' && process.env.OPENAI_API_KEY?.trim()) {
      console.warn('MiniMax TTS failed, trying OpenAI:', primaryErr.message);
      return textToSpeechOpenAI(text);
    }
    throw primaryErr;
  }
}

module.exports = { textToSpeech, resolveProvider, getTtsMaxChars };
