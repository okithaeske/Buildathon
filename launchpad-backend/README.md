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

Set `MOCK_AI=false` and configure Supabase and MiniMax (Token Plan key covers chat and web search for scan/audit). See [PRODUCTION.md](PRODUCTION.md) for the full checklist.

Health check: `GET http://localhost:3000/health` (alias: `/api/health`)

**Frontend team:**
- [FRONTEND_API_RATIONALE.md](FRONTEND_API_RATIONALE.md) — **why** the API works this way (read first)
- [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) — API contract (URLs, bodies, auth)
- [FRONTEND_UI_API_MAPPING.md](FRONTEND_UI_API_MAPPING.md) — map your UI pages/components to those APIs (for Cursor)

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
| `MINIMAX_GROUP_ID` | Optional for Token Plan; required for some pay-as-you-go TTS/music flows |
| `TTS_PROVIDER` | `openai` (default if `OPENAI_API_KEY` set) or `minimax` |
| `OPENAI_API_KEY` | TTS (recommended) and/or `IMAGE_PROVIDER=openai` |
| `OPENAI_TTS_MODEL` | `tts-1-hd` (default) or `tts-1` |
| `OPENAI_TTS_VOICE` | `nova`, `alloy`, `echo`, `fable`, `onyx`, `shimmer` |
| `IMAGE_PROVIDER` | `minimax` (default), `pollinations`, `openai`, or `placeholder` |
| `DEV_BYPASS_AUTH` | `true` = skip JWT (local only) |
| `USE_MEMORY_DB` | `true` = force in-memory DB |

### Web search (scan / audit)

Uses MiniMax **Token Plan** search: `POST /v1/coding_plan/search` with the same `MINIMAX_API_KEY` as chat. No separate search API key.

### Campaign banners (MiniMax image-01)

Default `IMAGE_PROVIDER=minimax` uses MiniMax **Text-to-Image** (`image-01`, 16:9) — same `MINIMAX_API_KEY` as chat and voice.

Fallbacks: `IMAGE_PROVIDER=pollinations` (free) or `openai` (DALL-E, paid).
