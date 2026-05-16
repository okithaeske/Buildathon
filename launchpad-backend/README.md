# LaunchPad AI — Backend API

Voice-first founder platform API for BuildATHON. Pitch Mode pipeline + Campaign Mode with async jobs.

**Full project documentation:** [../PROJECT.md](../PROJECT.md)

## Quick start

```bash
cd launchpad-backend
cp .env.example .env
# Fill all keys — see PRODUCTION.md
npm install
npm run dev
```

Set `MOCK_AI=false` and configure Supabase and MiniMax. See [PRODUCTION.md](PRODUCTION.md) for the full checklist.

Health check: `GET http://localhost:3000/health` (alias: `/api/health`)

Run the demo flow with [demo.http](demo.http) (VS Code REST Client).

## Docs

| File | Purpose |
|------|---------|
| [../PROJECT.md](../PROJECT.md) | **Main documentation** — architecture, pipelines, API, setup |
| [PRODUCTION.md](PRODUCTION.md) | Production env checklist |
| [DEPLOY.md](DEPLOY.md) | Railway deploy checklist |

## Deploy to Railway

1. Push repo to GitHub
2. New Railway project → Deploy from GitHub → select `launchpad-backend`
3. Set environment variables from `.env.example`
4. `nixpacks.toml` installs FFmpeg and Chromium for audio mix + PDF
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
| GET | `/api/session` | Yes |
| GET | `/api/session/:id/export/pdf` | Yes |
| GET | `/api/history` | Yes |

All protected routes: `Authorization: Bearer <access_token>`

See [../PROJECT.md](../PROJECT.md) for request bodies, job stages, and integration notes.
