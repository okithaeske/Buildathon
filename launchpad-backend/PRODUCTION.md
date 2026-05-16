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

## TTS / music quota (Token Plan)

On **Plus**, **Text to Speech · HD** is **4,000 characters per day** (not 4,000 requests). The dashboard `149 / 4,000` is **characters**.

The backend defaults to **1,500 characters per TTS call** (`MINIMAX_TTS_MAX_CHARS`, optional). Previously it sent up to 4,000 in one pitch — that could exceed your remaining daily characters (e.g. 149 used + 4,000 requested > 4,000 cap).

Music uses `music-2.6` with `is_instrumental: true` (Token Plan). If TTS still fails, wait for the daily reset or set a lower `MINIMAX_TTS_MAX_CHARS`.

## Supabase

- Run [supabase/schema.sql](supabase/schema.sql)
- Storage buckets (public): `audio`, `images`, `video`, `exports`
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
