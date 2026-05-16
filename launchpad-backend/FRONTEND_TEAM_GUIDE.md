# LaunchPad — Frontend Team Guide (complete)

**Copy this file into your frontend repo** (e.g. `docs/LAUNCHPAD_BACKEND.md`) and use it as the single source of truth for wiring the UI to the live API.

| | |
|---|---|
| **Backend (Railway)** | `https://buildathon-production-c28b.up.railway.app` |
| **Health check** | `GET /health` or `GET /api/health` |
| **Last updated** | May 2026 — includes job stage polling |

**Do not use** `launchpad_api_endpoints_deep.md` for URLs — it describes a different API shape.

---

## Table of contents

1. [Quick setup](#1-quick-setup)
2. [Architecture (why it works this way)](#2-architecture-why-it-works-this-way)
3. [Authentication](#3-authentication)
4. [API client (copy-paste)](#4-api-client-copy-paste)
5. [Pitch Mode — full pipeline](#5-pitch-mode--full-pipeline)
6. [Async jobs — polling & progress UI](#6-async-jobs--polling--progress-ui)
7. [Campaign Mode](#7-campaign-mode)
8. [Sessions & history](#8-sessions--history)
9. [Screen-by-screen mapping](#9-screen-by-screen-mapping)
10. [TypeScript types](#10-typescript-types)
11. [Ready-to-use code](#11-ready-to-use-code)
12. [Errors & edge cases](#12-errors--edge-cases)
13. [Old spec → real API cheat sheet](#13-old-spec--real-api-cheat-sheet)
14. [Pre-demo checklist](#14-pre-demo-checklist)
15. [Cursor prompt (copy-paste)](#15-cursor-prompt-copy-paste)

---

## 1. Quick setup

### Frontend `.env`

```env
VITE_API_URL=https://buildathon-production-c28b.up.railway.app
```

Use `${import.meta.env.VITE_API_URL}/api/...` for all calls.

**Do not** put MiniMax, OpenAI, or Supabase **service** keys in the frontend. AI runs on the backend only.

### localStorage keys (suggested)

```txt
launchpad_token       # access_token from signin
launchpad_sessionId   # current pitch session UUID
launchpad_jobId       # current async job (pitch or campaign)
```

### CORS (backend team must configure on Railway)

```txt
CORS_ORIGIN=http://localhost:5173,https://builddathon-2026.vercel.app
```

If sign-in fails in the browser but `/health` works in a new tab → **CORS** — ask backend to add your Vercel URL and redeploy.

### Optional: mock UI without backend

```env
VITE_USE_MOCK_API=true
```

Fake delays locally. **Turn off for demo** — judges need the real pipeline.

---

## 2. Architecture (why it works this way)

```txt
Browser  →  Node API (Railway)  →  MiniMax + Supabase
```

| Principle | What it means for you |
|-----------|----------------------|
| **Thin client** | All AI via `fetch` to backend. Never call `api.minimax.io` from the browser. |
| **No `POST /api/pitch/generate`** | Use multi-step pipeline + job poll (see below). |
| **Auth required** | Bearer token on every route except health + sign-up/sign-in. |
| **`transcript` not `idea`** | Merge form fields into one string for `POST /api/capture`. |
| **Async jobs** | `POST /api/pitch` and `POST /api/campaign` return `202` + `jobId` — poll for results. |
| **No `POST /api/sessions`** | Session is created on capture and updated each step. |
| **`/api/session` singular** | Not `/api/sessions`. |
| **Job success = `status: "done"`** | Not `"completed"`. |

---

## 3. Authentication

### Sign up

```http
POST /api/auth/signup
Content-Type: application/json

{ "email": "user@example.com", "password": "testpassword123", "name": "Optional" }
```

### Sign in

```http
POST /api/auth/signin
Content-Type: application/json

{ "email": "user@example.com", "password": "testpassword123" }
```

**Response:**

```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "access_token": "eyJ...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

Store `access_token` and send on all protected requests:

```http
Authorization: Bearer <access_token>
```

### Current user

```http
GET /api/auth/me
```

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "tier": "free",
  "pitch_count": 0,
  "campaign_count": 0
}
```

### Logout (required in nav)

```http
POST /api/auth/signout
```

Also works: `POST /api/auth/logout`.

**Frontend must:**

1. Call signout (optional but good practice)
2. Remove `launchpad_token` from localStorage
3. Clear `sessionId` / `jobId`
4. Redirect to `/login`
5. On any **401**, clear token and redirect to login

---

## 4. API client (copy-paste)

```ts
// src/lib/apiClient.ts
const BASE = import.meta.env.VITE_API_URL;

export function getToken() {
  return localStorage.getItem('launchpad_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('launchpad_token', token);
  else localStorage.removeItem('launchpad_token');
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.message ?? `Request failed (${res.status})`, res.status, data.error);
  }
  return data as T;
}

export async function signIn(email: string, password: string) {
  const data = await api<{ access_token: string }>('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data;
}

export async function signOut() {
  try {
    await api('/api/auth/signout', { method: 'POST' });
  } finally {
    setToken(null);
  }
}
```

---

## 5. Pitch Mode — full pipeline

There is **no** single generate endpoint. Run steps in order and show a **stepper** in the UI.

### Pipeline order (required)

```txt
capture → scan, audit → refine (5 Q&A) → validate → pitch (async job) → session
```

Later steps depend on earlier data. `POST /api/pitch` returns `INVALID_STATE` if validate was skipped.

### Step table

| # | UI label (suggested) | Method | Path | Body |
|---|----------------------|--------|------|------|
| 1 | Understanding your idea… | POST | `/api/capture` | `{ "transcript": "..." }` |
| 2 | Researching market… | POST | `/api/scan` | `{ "sessionId" }` |
| 3 | Checking risks… | POST | `/api/audit` | `{ "sessionId" }` |
| 4 | Founder interview… | POST | `/api/refine/start` | `{ "sessionId" }` |
| 5 | Questions 1–5 | POST | `/api/refine/answer` | `{ "sessionId", "questionIndex": 0–4, "answerTranscript" }` |
| 6 | Building profile… | POST | `/api/refine/complete` | `{ "sessionId" }` |
| 7 | Scoring viability… | POST | `/api/validate` | `{ "sessionId" }` |
| 8 | Generating pitch… | POST | `/api/pitch` | `{ "sessionId" }` → **202** + `jobId` |
| 9 | Building deck & audio… | GET | `/api/jobs/:jobId` | Poll every 2–3s |
| 10 | Done | GET | `/api/session/:sessionId` | Full session |

### Build transcript from form fields

```ts
function buildTranscript(form: {
  idea: string;
  country?: string;
  industry?: string;
  founderContext?: string;
  outputTone?: string;
}) {
  return [
    form.idea,
    form.country && `Country: ${form.country}`,
    form.industry && `Industry: ${form.industry}`,
    form.founderContext && `Founder context: ${form.founderContext}`,
    form.outputTone && `Output tone: ${form.outputTone}`,
  ]
    .filter(Boolean)
    .join('\n');
}
```

### Capture response (201)

```json
{
  "sessionId": "uuid",
  "conceptSummary": { },
  "disclaimer": "AI-assisted analysis — not legal or financial advice."
}
```

### Refine responses

**`POST /api/refine/start`** → `{ questionIndex, question, audioUrl, done: false }`

**`POST /api/refine/answer`** → next question or `{ done: true }`

Use field name **`answerTranscript`** (not `answer`).

**`POST /api/refine/complete`** → `{ ideaProfile }`

### Start pitch job (202)

```json
{
  "jobId": "uuid",
  "status": "processing",
  "progress": "queued",
  "stages": [
    { "key": "queued", "label": "Queued" },
    { "key": "generating_content", "label": "Writing pitch deck, investor Q&A, and marketing copy…" }
  ]
}
```

### Minimum viable path (if time is short)

Still need refine before validate:

`signin` → `capture` → `refine/start` + 5× `refine/answer` + `refine/complete` → `validate` → `pitch` → poll job → `GET /api/session/:id`

You can skip **scan** and **audit** in the UI only if you still call them or accept weaker demo data — but **do not skip refine**.

---

## 6. Async jobs — polling & progress UI

Both **pitch** and **campaign** use the same pattern.

### Flow

1. `POST /api/pitch` or `POST /api/campaign` → save `jobId`
2. Poll `GET /api/jobs/:jobId` every **2–3 seconds**
3. Update UI from `progressLabel`, `progressPercent`, `stages`
4. When `status === "done"` → use `result`
5. When `status === "failed"` → show `error`

### Poll response shape (current API)

```json
{
  "jobId": "uuid",
  "type": "pitch",
  "status": "processing",
  "progress": "tts",
  "progressLabel": "Generating voiceover…",
  "progressIndex": 2,
  "progressTotal": 7,
  "progressPercent": 40,
  "stages": [
    { "key": "queued", "label": "Queued" },
    { "key": "generating_content", "label": "Writing pitch deck, investor Q&A, and marketing copy…" },
    { "key": "tts", "label": "Generating voiceover…" },
    { "key": "music", "label": "Creating background music…" },
    { "key": "mixing", "label": "Mixing audio…" },
    { "key": "uploading", "label": "Uploading pitch audio…" },
    { "key": "done", "label": "Complete" }
  ],
  "result": null,
  "error": null
}
```

### `status` values

| `status` | Meaning | UI |
|----------|---------|-----|
| `queued` | Job created, not started | Spinner |
| `processing` | Running | Stepper + `progressLabel` + bar |
| `done` | Success | Navigate to results; read `result` |
| `failed` | Error | Show `error`; offer retry |

**Important:** Success is `status === "done"`, **not** `"completed"`.

### Pitch job stages (`progress` keys)

| `progress` | `progressLabel` (from API) |
|------------|----------------------------|
| `queued` | Queued |
| `generating_content` | Writing pitch deck, investor Q&A, and marketing copy… |
| `tts` | Generating voiceover… |
| `music` | Creating background music… |
| `mixing` | Mixing audio… |
| `uploading` | Uploading pitch audio… |
| `done` | Complete |

### Campaign job stages

| `progress` | When |
|------------|------|
| `queued` | Always first |
| `scraping_url` | Only if `productUrl` was sent |
| `generating_copy` | LLM ad copy |
| `generating_banner` | Image |
| `generating_voice` | TTS |
| `generating_music` | Background music |
| `mixing_audio` | FFmpeg mix |
| `generating_video` | Video (may be null) |
| `done` | Finished |

### Pitch `result` object

```json
{
  "pitchDeck": [{ "slide": 1, "title": "Hook", "content": "..." }],
  "investorQA": [{ "question": "...", "framework": "..." }],
  "marketingPack": { "taglines": [], "heroCopy": "...", "socialPosts": {}, "coldEmail": "...", "pressRelease": "...", "seoKeywords": [] },
  "audioUrl": "https://....supabase.co/.../pitch-....mp3",
  "audioWarning": "MiniMax TTS: usage limit exceeded"
}
```

If `audioWarning` is set and `audioUrl` is null, show pitch text results with a toast: *“Deck ready — voice audio unavailable.”*

### Campaign `result` object

```json
{
  "campaignId": "uuid",
  "adScript": "...",
  "taglines": ["...", "...", "..."],
  "captions": { "instagram": "...", "tiktok": "...", "twitter": "..." },
  "emailCopy": "...",
  "heroCopy": "...",
  "bannerUrl": "https://...",
  "audioUrl": "https://...",
  "videoUrl": null
}
```

### Optional: stage list without a job

```http
GET /api/jobs/stages/pitch
GET /api/jobs/stages/campaign
```

```json
{
  "type": "pitch",
  "stages": [{ "key": "queued", "label": "Queued" }, ...]
}
```

Use to build a stepper layout before the user clicks Generate.

### Campaign start response (202)

```json
{
  "jobId": "uuid",
  "campaignId": "uuid",
  "status": "processing",
  "progress": "queued",
  "stages": [{ "key": "queued", "label": "Queued" }, ...]
}
```

---

## 7. Campaign Mode

```http
POST /api/campaign
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Small clothing brand in Colombo",
  "tone": "professional",
  "productUrl": "https://optional.com"
}
```

**`tone`:** `energetic` | `professional` | `emotional` | `funny`

| Your form field | API field |
|-----------------|-----------|
| `businessDescription` | `description` |
| `productUrl` | `productUrl` |
| `tone` | `tone` |
| `platform` | **Not in API** — append to `description` if needed |

Poll `GET /api/jobs/:jobId`, then download ZIP:

```http
GET /api/campaign/:campaignId/download
```

Returns ZIP when campaign `status` is `done` (409 if still processing).

---

## 8. Sessions & history

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/session` | List current user's sessions |
| GET | `/api/session/:id` | Full session (all pipeline outputs) |
| GET | `/api/session/:id/export/pdf` | JSON report download (filename says pdf; body is JSON) |

No `POST /api/session` — saving is automatic.

### Results page — field mapping

| UI section | Session / job field |
|------------|---------------------|
| Concept summary | `concept_summary` |
| Clarifying questions | `refine_questions` |
| Market scan | `scan_result` |
| Risk register | `audit_result` |
| Viability score | `viability_score` |
| Pitch deck | `pitch_output.pitchDeck` or `job.result.pitchDeck` |
| Investor Q&A | `pitch_output.investorQA` or `job.result.investorQA` |
| Marketing pack | `job.result.marketingPack` |
| Pitch audio | `audio_url` or `job.result.audioUrl` |

---

## 9. Screen-by-screen mapping

| Route | Purpose | APIs |
|-------|---------|------|
| `/` | Landing | `GET /health` (optional) |
| `/login` | Sign in | `POST /api/auth/signin` |
| `/signup` | Register | `POST /api/auth/signup` |
| `/pitch` | Idea + pipeline | See [§5](#5-pitch-mode--full-pipeline) |
| `/pitch/:sessionId` | Results | `GET /api/session/:id` |
| `/campaign` | Campaign form + job | `POST /api/campaign` + poll |
| `/history` | Past sessions | `GET /api/session` |

Protect `/pitch`, `/campaign`, `/history` — redirect to `/login` if no token.

### Global UI

| Element | Logic |
|---------|--------|
| API status | `GET /health` → `status === 'ok'` |
| Nav email | `GET /api/auth/me` |
| Log out | `POST /api/auth/signout` + clear token |
| Errors | Toast `response.message` |

---

## 10. TypeScript types

```ts
// src/types/launchpad.ts

export type JobStage = { key: string; label: string };

export type JobPollResponse = {
  jobId: string;
  type: 'pitch' | 'campaign';
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: string;
  progressLabel: string;
  progressIndex: number;
  progressTotal: number;
  progressPercent: number;
  stages: JobStage[];
  result: PitchJobResult | CampaignJobResult | null;
  error: string | null;
};

export type PitchJobResult = {
  pitchDeck: Array<{ slide: number; title: string; content: string }>;
  investorQA: Array<{ question: string; framework: string }>;
  marketingPack?: {
    taglines: string[];
    heroCopy: string;
    socialPosts: Record<string, string>;
    coldEmail: string;
    pressRelease: string;
    seoKeywords: string[];
  };
  audioUrl: string | null;
  audioWarning?: string;
};

export type CampaignJobResult = {
  campaignId: string;
  adScript: string;
  taglines: string[];
  captions: { instagram: string; tiktok: string; twitter: string };
  emailCopy: string;
  heroCopy: string;
  bannerUrl: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
};

export type PitchWizardStep =
  | 'idle'
  | 'capture'
  | 'scan'
  | 'audit'
  | 'refine'
  | 'validate'
  | 'pitch'
  | 'done';
```

---

## 11. Ready-to-use code

### Job polling service

```ts
// src/services/jobService.ts
import { api } from '../lib/apiClient';
import type { JobPollResponse } from '../types/launchpad';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function pollJob<T = JobPollResponse['result']>(
  jobId: string,
  onUpdate?: (job: JobPollResponse) => void,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<T> {
  const intervalMs = options?.intervalMs ?? 2500;
  const maxAttempts = options?.maxAttempts ?? 120; // ~5 min

  for (let i = 0; i < maxAttempts; i++) {
    const job = await api<JobPollResponse>(`/api/jobs/${jobId}`);
    onUpdate?.(job);

    if (job.status === 'done') return job.result as T;
    if (job.status === 'failed') {
      throw new Error(job.error ?? 'Job failed');
    }

    await sleep(intervalMs);
  }

  throw new Error('Job timed out');
}
```

### Progress bar + label component

```tsx
// src/components/JobProgress.tsx
import type { JobPollResponse } from '../types/launchpad';

export function JobProgress({ job }: { job: JobPollResponse | null }) {
  if (!job) return null;

  return (
    <motion.div className="w-full max-w-md space-y-3" layout>
      <p className="text-sm text-muted-foreground">{job.progressLabel}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${job.progressPercent}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Step {job.progressIndex + 1} of {job.progressTotal}
      </p>
    </motion.div>
  );
}
```

### Stepper component

```tsx
// src/components/JobStepper.tsx
import type { JobPollResponse } from '../types/launchpad';

export function JobStepper({ job }: { job: JobPollResponse }) {
  return (
    <ol className="space-y-2 text-sm">
      {job.stages.map((stage, i) => {
        const done = i < job.progressIndex;
        const active = stage.key === job.progress;
        const failed = job.status === 'failed' && active;

        return (
          <li
            key={stage.key}
            className={[
              done && 'text-muted-foreground',
              active && 'font-medium text-foreground',
              failed && 'text-destructive',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="mr-2">{done ? '✓' : active ? '●' : '○'}</span>
            {stage.label}
          </li>
        );
      })}
    </ol>
  );
}
```

### Start pitch + poll (React example)

```tsx
const [job, setJob] = useState<JobPollResponse | null>(null);
const [loading, setLoading] = useState(false);

async function generatePitch(sessionId: string) {
  setLoading(true);
  try {
    const start = await api<{
      jobId: string;
      stages: JobPollResponse['stages'];
    }>('/api/pitch', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });

    setJob({
      jobId: start.jobId,
      type: 'pitch',
      status: 'processing',
      progress: 'queued',
      progressLabel: 'Queued',
      progressIndex: 0,
      progressTotal: start.stages.length,
      progressPercent: 0,
      stages: start.stages,
      result: null,
      error: null,
    });

    const result = await pollJob<PitchJobResult>(start.jobId, setJob);

    if (result.audioWarning && !result.audioUrl) {
      toast.warning('Pitch ready — voice audio could not be generated.');
    }

    navigate(`/pitch/${sessionId}`, { state: { result } });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Pitch failed');
  } finally {
    setLoading(false);
  }
}
```

### Suggested folder structure

```txt
src/
  lib/
    apiClient.ts
  types/
    launchpad.ts
  services/
    authService.ts
    pitchService.ts      # capture, scan, audit, refine, validate, pitch
    campaignService.ts
    jobService.ts        # pollJob
  components/
    JobProgress.tsx
    JobStepper.tsx
  hooks/
    useAuth.ts
    usePitchPipeline.ts
  pages/
    LoginPage.tsx
    PitchPage.tsx
    PitchResultPage.tsx
    CampaignPage.tsx
    HistoryPage.tsx
```

---

## 12. Errors & edge cases

### Error body

```json
{
  "error": "VALIDATION",
  "message": "Human-readable message"
}
```

| Code | HTTP | UI |
|------|------|-----|
| `VALIDATION` | 400 | Fix form |
| `UNAUTHORIZED` | 401 | Redirect login |
| `INVALID_STATE` | 400 | e.g. pitch before validate — show “Complete interview first” |
| `NOT_FOUND` | 404 | Session/job missing |
| `NOT_READY` | 409 | Campaign ZIP before done |
| `INTERNAL_ERROR` | 500 | Retry |

### Common pitfalls

| Mistake | Fix |
|---------|-----|
| `status === 'completed'` | Use `status === 'done'` |
| Only showing raw `progress` key (`tts`) | Use `progressLabel` from API |
| Calling `/api/pitch/generate` | Use full pipeline + `/api/pitch` |
| Sending `{ idea }` to capture | Send `{ transcript }` |
| `refine/answer` field `answer` | Use `answerTranscript` |
| `localhost:3000` in prod `.env` | Use Railway URL |
| One 2-minute spinner, no poll | Poll job every 2–3s |
| Ignoring `audioWarning` | Toast when audio skipped |

---

## 13. Old spec → real API cheat sheet

| Old / design doc | Implement as |
|------------------|--------------|
| `GET /api/health` | `GET /health` or `GET /api/health` |
| `POST /api/pitch/generate` | Full pipeline (§5) |
| `POST /api/pitch/summary` | `POST /api/capture` |
| `POST /api/pitch/questions` | `POST /api/refine/start` |
| `POST /api/pitch/market-scan` | `POST /api/scan` |
| `POST /api/pitch/risk-audit` | `POST /api/audit` |
| `POST /api/pitch/viability-score` | `POST /api/validate` |
| `POST /api/pitch/deck` | `POST /api/pitch` + job poll |
| `POST /api/campaign/generate` | `POST /api/campaign` + job poll |
| `GET /api/sessions/:id` | `GET /api/session/:id` |
| `POST /api/auth/logout` | `POST /api/auth/signout` |
| Job finished | `job.status === 'done'` |

---

## 14. Pre-demo checklist

- [ ] `VITE_API_URL` = Railway production URL
- [ ] Backend deployed with latest job stage API
- [ ] `CORS_ORIGIN` on Railway includes your Vercel URL
- [ ] Sign in / sign up / log out work
- [ ] Pitch stepper shows pipeline steps (capture → … → pitch)
- [ ] Pitch/campaign loading uses **`progressLabel`** + **progress bar** (`progressPercent`)
- [ ] Poll treats success as **`status === 'done'`**
- [ ] Results page uses `GET /api/session/:id`
- [ ] Campaign polls job + ZIP download works
- [ ] `VITE_USE_MOCK_API` is **false** for judging
- [ ] Supabase Auth redirect URLs include frontend + Railway (if using Supabase client)

---

## 15. Cursor prompt (copy-paste)

Open your **frontend** repo in Cursor, add this file, then run:

```text
Read docs/LAUNCHPAD_BACKEND.md (or FRONTEND_TEAM_GUIDE.md) as the only API contract.

Implement:
1. apiClient with Bearer token, signin, signout, 401 redirect
2. Full pitch pipeline with visible stepper (capture → scan → audit → refine → validate → pitch)
3. pollJob using progressLabel, progressPercent, stages; success when status === "done"
4. JobProgress + JobStepper components during pitch and campaign jobs
5. Campaign page: POST /api/campaign, poll job, download ZIP
6. Results from GET /api/session/:id

Do NOT use /api/pitch/generate, /api/sessions, or status === "completed".
Map businessDescription → description for campaign.
```

---

## Backend contact / repo files

If you need raw HTTP examples: `launchpad-backend/demo.http`

Backend maintainers: deploy latest `launchpad-backend` to Railway before testing new job fields.

**Questions?** Ping the backend team with: endpoint path, request body, response status, and `jobId` if applicable.
