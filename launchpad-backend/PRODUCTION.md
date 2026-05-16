# Production checklist

## Required `.env` (Railway / production)

```env
NODE_ENV=production
MOCK_AI=false
DEV_BYPASS_AUTH=false
USE_MEMORY_DB=false

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

MINIMAX_API_KEY=your_token_plan_key
MINIMAX_API_BASE=https://api.minimax.io

IMAGE_PROVIDER=minimax
CORS_ORIGIN=http://localhost:5173,https://your-frontend.vercel.app
```

**Token Plan (recommended):** use the **Coding / Token Plan API key** as `MINIMAX_API_KEY`. You do **not** need `MINIMAX_GROUP_ID` — the backend only sends `GroupId` when that variable is set.

Campaign banners use **MiniMax `image-01`** (text-to-image, 16:9) — same API key as chat/TTS.

## MiniMax Group ID (optional)

Only for **legacy pay-as-you-go** accounts that require a separate Group ID:

1. [platform.minimax.io](https://platform.minimax.io) → User Center / Basic Information
2. Copy **Group ID** → `MINIMAX_GROUP_ID=`

Skip this if you only have a Token Plan key.

## Pitch deck / presentation (OpenAI recommended)

When `OPENAI_API_KEY` is set, the pitch job uses **OpenAI** (`gpt-4o-mini` by default) for:

- 10-slide deck JSON
- Investor Q&A
- Marketing pack

Set explicitly:

```env
OPENAI_API_KEY=sk-...
PITCH_LLM_PROVIDER=openai
OPENAI_PROMPT_MODEL=gpt-4o-mini
```

Use `PITCH_LLM_PROVIDER=minimax` to force MiniMax for pitch text only. Slide images and music still use MiniMax; the pitch deck PDF is rendered locally with headless Chromium via `puppeteer`. On OpenAI failure, pitch text falls back to MiniMax automatically.

### Pitch deck PDF (Chromium)

The pitch job exports a polished PDF using `puppeteer` + system Chromium. On Railway/Nixpacks, [`nixpacks.toml`](nixpacks.toml) installs `chromium` and sets `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` plus `PUPPETEER_SKIP_DOWNLOAD=true` so the deploy stays small. For local development, leaving these unset lets `npm install puppeteer` download a bundled Chromium.

`GET /health` reports `pitchLlmProvider` and `openai: true|false`.

## Text-to-speech (OpenAI recommended)

Set on Railway:

```env
TTS_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_TTS_MODEL=tts-1-hd
OPENAI_TTS_VOICE=nova
```

OpenAI TTS is **pay-per-use** (~$15–30 per 1M characters), **4,096 chars per request**, no MiniMax 4k/day cap. MiniMax stays used for chat, search, music, and images.

If `OPENAI_API_KEY` is set and `TTS_PROVIDER` is unset, **openai** is chosen automatically. On failure, the backend tries the other provider when its key is configured.

### MiniMax TTS only (optional)

On **Plus**, MiniMax **Text to Speech · HD** is **4,000 characters per day**. Use `TTS_PROVIDER=minimax` and `MINIMAX_TTS_MAX_CHARS=1500` if you rely on Token Plan for voice.

Music uses `music-2.6` with `is_instrumental: true` (Token Plan).

## Supabase

- Run [supabase/schema.sql](supabase/schema.sql) on a **new** project (includes `campaigns.reference_image_url`)
- **Existing** project already on schema v1: run [supabase/migrations/002_campaign_reference_image.sql](supabase/migrations/002_campaign_reference_image.sql) in the SQL Editor
- Storage buckets (public read): `audio`, `images`, `video`, `exports` — campaign reference photos and banners use the existing **`images`** bucket (no new bucket)
- The **`images`** bucket must be **public** so MiniMax can fetch `reference_image_url` for image-to-image generation
- Email auth enabled, confirm email **off**

## Verify

```bash
curl https://your-api.railway.app/health
```

Expect `"mockAi": false`, `"supabase": true`, and `"webSearch": "minimax"` when `MINIMAX_API_KEY` is set.

## Cost summary (no OpenAI needed)

| Service | Used for |
|---------|----------|
| Supabase | Auth, DB, file storage |
| MiniMax | Chat, TTS, music, web search (scan/audit), video (optional) |
| MiniMax image-01 | Campaign banners (same API key) |
