# Railway deployment checklist

## Pre-deploy

- [ ] Run [supabase/schema.sql](supabase/schema.sql) in Supabase SQL Editor
- [ ] Create Storage buckets: `audio`, `video`, `images`, `exports` (public read for demo)
- [ ] Enable Supabase Email auth provider
- [ ] Add frontend URL to Supabase Auth redirect URLs

## Railway variables

```
NODE_ENV=production
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
MINIMAX_API_KEY=
IMAGE_PROVIDER=pollinations
OPENAI_API_KEY=
CORS_ORIGIN=https://your-frontend.vercel.app
MOCK_AI=false
DEV_BYPASS_AUTH=false
```

## Verify

```bash
curl https://YOUR-APP.up.railway.app/health
```

## Frontend teammate

Set `VITE_API_URL=https://YOUR-APP.up.railway.app` on Vercel.
