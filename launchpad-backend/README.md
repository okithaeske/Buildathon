# LaunchPad AI — Backend API

Voice-first founder platform API for BuildATHON. Pitch Mode pipeline + Campaign Mode with async jobs.

## Quick start (production mode locally)

```bash
cd launchpad-backend
cp .env.example .env
# Fill all keys — see PRODUCTION.md
npm install
npm run dev
```

Set `MOCK_AI=false` and configure Supabase, MiniMax, Tavily. See [PRODUCTION.md](PRODUCTION.md) for the full checklist.

Health check: `GET http://localhost:3000/health`

Run the full demo flow with [demo.http](demo.http) (VS Code REST Client).

## Production setup

1. Create a [Supabase](https://supabase.com) project
2. Run SQL from [supabase/schema.sql](supabase/schema.sql)
3. Create Storage buckets: `audio`, `video`, `images`, `exports`
4. Enable Email auth (disable email confirm for faster hackathon testing)
5. Copy keys to `.env`:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
MINIMAX_API_KEY=...
TAVILY_API_KEY=...
IMAGE_PROVIDER=pollinations
OPENAI_API_KEY=
MOCK_AI=false
CORS_ORIGIN=https://your-frontend.vercel.app
```

## Deploy to Railway

1. Push repo to GitHub
2. New Railway project → Deploy from GitHub → select `launchpad-backend`
3. Set environment variables from `.env.example`
4. `nixpacks.toml` installs FFmpeg automatically
5. Verify: `curl https://your-app.up.railway.app/health`

## API overview

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | No |
| POST | `/api/auth/signup` | No |
| POST | `/api/auth/signin` | No |
| POST | `/api/auth/signout` | Yes |
| GET | `/api/auth/me` | Yes |
| POST | `/api/capture` | Yes |
| POST | `/api/scan` | Yes |
| POST | `/api/audit` | Yes |
| POST | `/api/refine/start` | Yes |
| POST | `/api/refine/answer` | Yes |
| POST | `/api/refine/complete` | Yes |
| POST | `/api/validate` | Yes |
| POST | `/api/pitch` | Yes → `202` + jobId |
| GET | `/api/jobs/:jobId` | Yes |
| POST | `/api/campaign` | Yes → `202` + jobId |
| GET | `/api/campaign/:id/download` | Yes |
| GET | `/api/session/:id` | Yes |
| GET | `/api/session` | Yes (list) |

All protected routes: `Authorization: Bearer <access_token>`

## Frontend integration

```js
// 1. Sign in
const { access_token } = await fetch(`${API}/api/auth/signin`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then(r => r.json());

// 2. All pipeline calls
fetch(`${API}/api/capture`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${access_token}`,
  },
  body: JSON.stringify({ transcript }),
});
```

## Environment variables

See [.env.example](.env.example).

| Variable | Description |
|----------|-------------|
| `MOCK_AI` | Must be `false` in production |
| `MINIMAX_GROUP_ID` | Required for voice/music (MiniMax user center) |
| `TAVILY_API_KEY` | Live web search for Scan/Audit ([free tier](https://tavily.com)) |
| `IMAGE_PROVIDER` | `pollinations` (free, default), `openai`, or `placeholder` |
| `OPENAI_API_KEY` | Only if `IMAGE_PROVIDER=openai` (paid DALL-E banners) |
| `DEV_BYPASS_AUTH` | `true` = skip JWT (local only) |
| `USE_MEMORY_DB` | `true` = force in-memory DB |

### Tavily API key (free tier for search)

1. Sign up at [https://tavily.com](https://tavily.com)
2. Open the dashboard → **API Keys** → **Create key**
3. Copy the key (starts with `tvly-`)
4. Add to `.env`: `TAVILY_API_KEY=tvly-...`
5. Set `MOCK_AI=false` to use real scan/audit search

Free plan: ~1,000 searches/month (enough for hackathon demos).

### Campaign banners (free — no OpenAI)

Default `IMAGE_PROVIDER=pollinations` uses [Pollinations.ai](https://pollinations.ai) — no API key, AI-generated images via URL.

Leave `OPENAI_API_KEY` empty. Optional paid upgrade: `IMAGE_PROVIDER=openai` + OpenAI key for DALL-E 3.
