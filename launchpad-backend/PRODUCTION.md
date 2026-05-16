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

TAVILY_API_KEY=tvly-...

IMAGE_PROVIDER=pollinations
CORS_ORIGIN=https://your-frontend.vercel.app
```

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

Expect `"mockAi": false` and `"supabase": true`.

## Cost summary (no OpenAI needed)

| Service | Used for |
|---------|----------|
| Supabase | Auth, DB, file storage |
| MiniMax | Chat, TTS, music, video (optional) |
| Tavily | Market scan, audit search |
| Pollinations | Campaign banners (free) |
