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

MINIMAX_API_KEY=sk-api-...
MINIMAX_GROUP_ID=your_group_id

IMAGE_PROVIDER=minimax
CORS_ORIGIN=http://localhost:5173,https://your-frontend.vercel.app
```

Campaign banners use **MiniMax `image-01`** (text-to-image, 16:9) — same API key as chat/TTS.

## MiniMax Group ID

1. [platform.minimax.io](https://platform.minimax.io) → User Center / Basic Information
2. Copy **Group ID**
3. Set `MINIMAX_GROUP_ID=` — required for TTS and music

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
