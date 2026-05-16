# LaunchPad — Frontend Team Guide (complete)

**Copy this file into your frontend repo** (e.g. `docs/LAUNCHPAD_BACKEND.md`) and use it as the single source of truth for wiring the UI to the live API.

| | |
|---|---|
| **Backend (Railway)** | `https://buildathon-production-c28b.up.railway.app` |
| **Health check** | `GET /health` or `GET /api/health` |
| **Last updated** | May 2026 — job stages, PDF export (replaces PPTX), delete history, personalized refine |

**Do not use** `launchpad_api_endpoints_deep.md` for URLs — it describes a different API shape.

**Response shapes:** [§16 Complete API response reference](#16-complete-api-response-reference) lists **every** endpoint’s JSON (and binary) output so the UI can be built field-by-field. [§10](#10-typescript-types) has matching TypeScript types.

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
16. [Complete API response reference](#16-complete-api-response-reference)

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

**Full JSON for each step:** [§16](#16-complete-api-response-reference) (capture through session, jobs, campaign, delete, exports).

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

Interview questions are **generated by MiniMax** from `concept_summary` when `refine/start` runs (5 tailored questions). If generation fails, the backend uses a fixed fallback list. Questions are stored on the session as `refine_questions` and reused if the user resumes.

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
| `generating_slide_images` | Designing slide visuals… |
| `generating_pdf` | Building pitch deck PDF… |
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
  "pitchDeck": [
    {
      "slide": 1,
      "layout": "title",
      "title": "Hook",
      "subtitle": "One-line tagline",
      "bullets": ["Short punchy point", "Another point"],
      "content": "Fallback paragraph if bullets are empty",
      "speakerNotes": "What the founder says aloud on this slide"
    }
  ],
  "investorQA": [{ "question": "...", "framework": "..." }],
  "marketingPack": { "taglines": [], "heroCopy": "...", "socialPosts": {}, "coldEmail": "...", "pressRelease": "...", "seoKeywords": [] },
  "audioUrl": "https://....supabase.co/.../pitch-....mp3",
  "pdfUrl": "https://....supabase.co/storage/v1/object/public/exports/USER_ID/pitch-SESSION_ID.pdf?download=LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf",
  "pdfFilename": "LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf",
  "slideImageUrls": [
    "https://....supabase.co/storage/v1/object/public/images/USER_ID/pitch-SESSION_ID-slide-1.png",
    null
  ],
  "audioWarning": "OpenAI/MiniMax TTS failed — voice skipped"
}
```

**`pdfUrl` already includes `?download=<pdfFilename>`** — so a plain `window.open(pdfUrl)` or `<a href={pdfUrl}>` triggers a download with a human-readable filename instead of the raw storage path. Use `pdfFilename` only when you need to render the filename in the UI (e.g. “Saved as `...pdf`”).

**Per-slide fields** (NotebookLM-style structured deck):

| Field | Type | Notes |
|-------|------|-------|
| `slide` | number | 1-indexed slide position |
| `layout` | `"title"` \| `"bullets"` \| `"metric"` \| `"chart"` \| `"competition"` | UI hint for how to render the slide |
| `title` | string | Always present, render bold |
| `subtitle` | string? | One-liner under the title |
| `bullets` | string[]? | 2-5 short bullets; preferred over `content` |
| `content` | string? | Fallback narrative paragraph when `bullets` empty |
| `speakerNotes` | string? | What the founder says aloud — show in presenter mode only |

**`slideImageUrls`** — array aligned 1:1 with `pitchDeck`. Each entry is either a public PNG URL (NotebookLM-style designed background image for that slide) or `null` when image generation failed for that slide. Use these in the in-app deck viewer for visual polish; they are the same images embedded full-bleed inside the downloaded `.pdf`.

If `audioWarning` is set and `audioUrl` is null, show pitch text results with a toast: *“Deck ready — voice audio unavailable.”*

If `pdfUrl` is null, call `GET /api/session/:sessionId/export/pdf` to build one on demand (requires `pitchDeck` already on the session).

### Pitch deck PDF download (.pdf)

The backend builds a polished **`.pdf`** file (cover, one page per `pitchDeck` slide with layout-aware rendering, citations page, and a presenter-notes appendix) during the pitch job and uploads it to the Supabase **`exports`** bucket (must exist and be **public**, same as `audio` / `images`). Rendering uses headless Chromium via `puppeteer`, so the PDF mirrors the visual design of the in-app deck viewer.

| Source | Field |
|--------|--------|
| After job completes | `job.result.pdfUrl` (already includes `?download=`) |
| Session / results page | `session.pitch_output.pdfUrl` |
| On demand | `GET /api/session/:id/export/pdf` |

**Meaningful filename.** The backend slugs the user’s `concept_summary.productType` (falls back to `summary` / `industry`) and the current date into a filename like `LaunchPad-Pitch-Deck-AI-Tutoring-Platform-2026-05-16.pdf`. The URL is returned with `?download=<filename>` appended, which Supabase Storage honours by setting `Content-Disposition: attachment; filename="..."`. The frontend does not have to build this filename — it’s already baked into `pdfUrl` and also returned separately as `pdfFilename`.

**On-demand export**

```http
GET /api/session/:sessionId/export/pdf
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "pdfUrl": "https://....supabase.co/storage/v1/object/public/exports/...?download=LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf",
  "pdfFilename": "LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf"
}
```

| Query | Behavior |
|-------|----------|
| (none) | Returns existing `pdfUrl` from session if already generated |
| `?regenerate=1` | Rebuilds and re-uploads the PDF |
| `?redirect=1` | HTTP redirect to the file URL (good for `<a download>`) |

**409** if pitch deck not generated yet (`NOT_READY`).

**Frontend button example:**

```ts
async function downloadPitchPdf(sessionId: string) {
  const url =
    session?.pitch_output?.pdfUrl ??
    (await api.get<{ pdfUrl: string }>(`/api/session/${sessionId}/export/pdf`)).pdfUrl;
  if (url) window.open(url, '_blank'); // browser uses ?download=... for the filename
}
```

You can also render slides in the UI from `pitchDeck` JSON; the PDF is the shareable artifact for investors and printing.

### In-app deck viewer (recommended)

`pitchDeck` is the editable source of truth. Build a presenter-mode deck viewer on top of it so users can review and refine before downloading the PDF.

**Suggested behaviour**

| Feature | Source |
|---------|--------|
| Slide carousel | `pitchDeck[]` ordered by `slide` |
| Slide background | `slideImageUrls[i]` with a dark overlay for legibility; fall back to brand gradient when `null` |
| Layout-aware rendering | Switch on `slide.layout`: `title` = centered hero, `bullets` = title + bullet list, `metric` = oversized headline number, `chart` = TAM/SAM/SOM bars, `competition` = comparison rows |
| Presenter mode | Fullscreen view + keyboard arrows + `speakerNotes` shown to the speaker only |
| Edit mode (v1) | Local state edits to `title`, `subtitle`, `bullets`, `content` — “Download PDF” still uses the existing `pdfUrl` |
| Sources panel | `session.scan_result.citations[]` (also appears on the “Sources & citations” page in the PDF) |

A minimal `slide.layout`-aware renderer:

```tsx
function SlideView({ slide, image }: { slide: PitchSlide; image?: string | null }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#1A1A2E]">
      {image && (
        <>
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/45" />
        </>
      )}
      <div className="relative z-10 flex h-full flex-col justify-center gap-4 p-10 text-white">
        {slide.layout === 'title' ? (
          <>
            <h1 className="text-center text-5xl font-bold">{slide.title}</h1>
            {slide.subtitle && <p className="text-center text-xl text-white/80">{slide.subtitle}</p>}
          </>
        ) : slide.layout === 'metric' ? (
          <>
            <p className="text-center text-base uppercase tracking-wide text-white/70">{slide.title}</p>
            <p className="text-center text-6xl font-bold">{slide.subtitle || slide.content}</p>
          </>
        ) : (
          <>
            <h2 className="text-4xl font-bold">{slide.title}</h2>
            {slide.subtitle && <p className="text-lg italic text-white/80">{slide.subtitle}</p>}
            {slide.bullets?.length ? (
              <ul className="mt-4 list-disc space-y-2 pl-6 text-xl">
                {slide.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            ) : (
              <p className="text-xl text-white/90">{slide.content}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

The PDF download exists for sharing with investors who prefer files; the in-app viewer is the primary review experience and stays in sync with whatever edits the user has made locally.

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
  "videoUrl": null,
  "referenceImageUrl": "https://.../campaign-uuid-ref.jpg"
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
  "referenceImageUrl": "https://....images/.../campaign-uuid-ref.jpg",
  "stages": [{ "key": "queued", "label": "Queued" }, ...]
}
```

`referenceImageUrl` is `null` when the user did not upload or pass a reference image.

---

## 7. Campaign Mode

**JSON (no file upload):**

```http
POST /api/campaign
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Small clothing brand in Colombo",
  "tone": "professional",
  "productUrl": "https://optional.com",
  "referenceImageUrl": "https://optional-public-url/product.jpg"
}
```

**Multipart (upload reference photo on the form):**

```http
POST /api/campaign
Authorization: Bearer <token>
Content-Type: multipart/form-data

description=Small clothing brand in Colombo
tone=professional
productUrl=https://optional.com
referenceImage=<file>   # optional, max 5MB, image/*
```

The backend uploads `referenceImage` to Supabase `images`, stores `reference_image_url` on the campaign, and uses it as MiniMax **subject_reference** when generating the banner. Banner prompts are written by **OpenAI** (`gpt-4o-mini` when `OPENAI_API_KEY` is set) or MiniMax chat, then rendered with **MiniMax image-01**.

**`tone`:** `energetic` | `professional` | `emotional` | `funny`

| Your form field | API field |
|-----------------|-----------|
| `businessDescription` | `description` |
| `productUrl` | `productUrl` |
| `tone` | `tone` |
| Product / brand photo file | `referenceImage` (multipart) or `referenceImageUrl` (JSON) |
| `platform` | **Not in API** — append to `description` if needed |

Poll `GET /api/jobs/:jobId`, then download ZIP:

```http
GET /api/campaign/:campaignId/download
```

Returns ZIP when campaign `status` is `done` (409 if still processing).

Remove a campaign from history:

```http
DELETE /api/campaign/:campaignId
```

### Reference image — frontend implementation

| Rule | Detail |
|------|--------|
| **When to use multipart** | User picks a file in the campaign form → `FormData` + field name **`referenceImage`** |
| **When to use JSON** | No file, or you already uploaded elsewhere → optional **`referenceImageUrl`** (must be a **public** URL MiniMax can fetch) |
| **Do not set `Content-Type`** on multipart `fetch` | Browser sets `multipart/form-data` + boundary automatically |
| **Max size** | 5 MB; types `image/jpeg`, `image/png`, `image/webp` |
| **Validation errors** | `400` `{ "error": "VALIDATION", "message": "..." }` (wrong type, file too large) |

**`campaignService.ts` — submit with optional file:**

```ts
export async function startCampaign(
  token: string,
  input: {
    description: string;
    tone: 'energetic' | 'professional' | 'emotional' | 'funny';
    productUrl?: string;
    referenceImage?: File;
    referenceImageUrl?: string;
  }
): Promise<CampaignStartResponse> {
  const base = import.meta.env.VITE_API_URL;

  if (input.referenceImage) {
    const form = new FormData();
    form.append('description', input.description);
    form.append('tone', input.tone);
    if (input.productUrl) form.append('productUrl', input.productUrl);
    form.append('referenceImage', input.referenceImage);

    const res = await fetch(`${base}/api/campaign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw await res.json();
    return res.json();
  }

  const res = await fetch(`${base}/api/campaign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: input.description,
      tone: input.tone,
      productUrl: input.productUrl,
      referenceImageUrl: input.referenceImageUrl,
    }),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}
```

**UI suggestions:**

- Form: optional **“Product / brand photo”** file input; show a local preview with `URL.createObjectURL(file)` before submit.
- After **202**: you can show `referenceImageUrl` from the start response (uploaded copy on Supabase).
- Results (job `result`): show **`bannerUrl`** as the generated ad; optionally show **`referenceImageUrl`** as “Your upload” vs “Generated banner”.
- Client-side guard: reject files over 5 MB before POST to avoid a round trip.

---

## 8. Sessions & history

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/history` | **Combined** — `{ pitches, campaigns }` for the History tab |
| GET | `/api/session` | List current user's pitch sessions only |
| GET | `/api/session/:id` | Full session (all pipeline outputs) |
| GET | `/api/session/:id/export/pdf` | Pitch deck PDF download URL (see [Pitch deck PDF download](#pitch-deck-pdf-download-pdf) below) |
| GET | `/api/session/:id/export/report` | Full session JSON report download (concept, scan, audit, viability, pitch) |
| DELETE | `/api/session/:id` | Permanently delete a single pitch session |
| DELETE | `/api/session` | **Delete all** of the current user's pitch sessions |
| GET | `/api/campaign` | List current user's campaigns only |
| GET | `/api/campaign/:id` | Full campaign row |
| DELETE | `/api/campaign/:id` | Permanently delete a single campaign |
| DELETE | `/api/campaign` | **Delete all** of the current user's campaigns |

No `POST /api/session` — saving is automatic.

### Combined history (Pitch + Campaign tabs)

For a single History page with two tabs (Pitched / Campaigns), call **one** endpoint:

```http
GET /api/history
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "pitches": [
    {
      "id": "uuid",
      "title": "AI Tutoring Platform",
      "stage": "pitched",
      "concept_summary": { "summary": "One-line idea summary" },
      "created_at": "ISO",
      "updated_at": "ISO"
    }
  ],
  "campaigns": [
    {
      "id": "uuid",
      "title": "Small clothing brand in Colombo",
      "description": "Small clothing brand in Colombo focused on premium fabrics",
      "tone": "professional",
      "status": "done",
      "banner_url": "https://....images/.../banner.png",
      "audio_url": "https://....audio/.../campaign.mp3",
      "created_at": "ISO",
      "updated_at": "ISO"
    }
  ]
}
```

Each list is the same shape as `GET /api/session` / `GET /api/campaign` individually. Both arrays are sorted by `updated_at` desc.

**Use `title` for the card heading** — it’s the backend’s pre-computed human-readable label so you never have to display "Pitch 1 / Pitch 2 / …":

| Field | Pitches | Campaigns |
|-------|---------|-----------|
| `title` | `concept_summary.productType` → first sentence of `summary` → `industry` → "Untitled pitch" | `description` (first sentence, max 80 chars) → "Untitled campaign" |
| Subtitle (optional) | `concept_summary.summary` (full) | `tone` chip + `status` badge |
| Thumbnail | (none) | `banner_url` |
| Timestamp | `updated_at` | `updated_at` |

**Suggested UI:**

```tsx
const [tab, setTab] = useState<'pitches' | 'campaigns'>('pitches');
const { data } = useQuery(['history'], () =>
  api<{ pitches: SessionListItem[]; campaigns: CampaignListItem[] }>('/api/history')
);

return (
  <>
    <Tabs value={tab} onChange={setTab}>
      <Tab id="pitches">Pitched ({data?.pitches.length ?? 0})</Tab>
      <Tab id="campaigns">Campaigns ({data?.campaigns.length ?? 0})</Tab>
    </Tabs>
    {tab === 'pitches'
      ? data?.pitches.map((s) => <PitchCard key={s.id} session={s} />)
      : data?.campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
  </>
);
```

Opening a card:

| Tab | On click | Then |
|-----|----------|------|
| Pitched | `GET /api/session/:id` | Render full pitch results page |
| Campaigns | `GET /api/campaign/:id` | Render full campaign results page |

Deleting:

| Tab | Per item | Clear all (with confirm) |
|-----|----------|--------------------------|
| Pitched | `DELETE /api/session/:id` | `DELETE /api/session` |
| Campaigns | `DELETE /api/campaign/:id` | `DELETE /api/campaign` |

After delete, re-fetch `GET /api/history` or optimistically remove the row from local state.

### Delete pitch history

**One session:**

```http
DELETE /api/session/:sessionId
Authorization: Bearer <token>
```

```json
{ "ok": true, "deletedId": "uuid" }
```

**All sessions for the current user:**

```http
DELETE /api/session
Authorization: Bearer <token>
```

```json
{ "ok": true, "deletedCount": 5, "deletedIds": ["uuid1", "uuid2", "..."] }
```

- Only the **owner** can delete (`403` if wrong user, `404` if not found).
- Also deletes related **jobs** for each session.
- Best-effort cleanup of **audio** / **exports** files (pitch MP3, refine question audio, PDF).
- `deletedCount` is `0` if the user already has no sessions — call is idempotent.

**History page UI:** After success, remove the card(s) from local state or refetch `GET /api/session`. For “Clear history”, prompt the user to confirm before calling the bulk endpoint.

```ts
async function deletePitchSession(sessionId: string) {
  await api(`/api/session/${sessionId}`, { method: 'DELETE' });
}

async function deleteAllPitchSessions() {
  return api<{ deletedCount: number; deletedIds: string[] }>(
    '/api/session',
    { method: 'DELETE' }
  );
}
```

### Delete campaign

**One campaign:**

```http
DELETE /api/campaign/:campaignId
Authorization: Bearer <token>
```

```json
{ "ok": true, "deletedId": "uuid" }
```

**All campaigns for the current user:**

```http
DELETE /api/campaign
Authorization: Bearer <token>
```

```json
{ "ok": true, "deletedCount": 3, "deletedIds": ["uuid1", "uuid2", "uuid3"] }
```

Removes the campaign row(s), associated jobs, and common storage files (banner, campaign audio, reference image). The bulk delete works even without knowing IDs (it operates on the authenticated user).

### Campaign history (list + single)

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/campaign` | Slim list of the user's campaigns |
| `GET` | `/api/campaign/:id` | Full campaign row (all fields) |

**List response:**

```json
{
  "campaigns": [
    {
      "id": "uuid",
      "title": "Small clothing brand in Colombo",
      "description": "Small clothing brand in Colombo focused on premium fabrics",
      "tone": "professional",
      "status": "done",
      "banner_url": "https://....images/.../banner.png",
      "audio_url": "https://....audio/.../campaign.mp3",
      "created_at": "ISO timestamp",
      "updated_at": "ISO timestamp"
    }
  ]
}
```

Sorted by `updated_at` desc — newest first. Use `title` (pre-computed first-sentence label, max 80 chars) as the card heading; show `tone` as a chip, `banner_url` as the thumbnail, `status` as a badge (`processing` / `done` / `failed`). `description` is still available if you want to render the full text in a card subtitle.

**Single campaign response** (`GET /api/campaign/:id`):

Full DB row (snake_case fields) including `ad_script`, `taglines`, `captions`, `email_copy`, `hero_copy`, `banner_url`, `audio_url`, `video_url`, `reference_image_url`, `product_url`, `status`, `created_at`, `updated_at`. Use for a campaign results page — same data as `job.result` but persisted on the row.

Owner-only: `403` if the campaign belongs to another user, `404` if it does not exist.

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
| Download PDF | `pitch_output.pdfUrl` or `job.result.pdfUrl` or `GET .../export/pdf` |
| On-screen slides | `pitch_output.pitchDeck` or `job.result.pitchDeck` (render in UI) |

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
| `/history` | Past pitches + campaigns (two tabs) | `GET /api/history` → `{ pitches, campaigns }`; open via `GET /api/session/:id` or `GET /api/campaign/:id`; delete single or bulk |
| `/campaign/:campaignId` | Campaign results | `GET /api/campaign/:id` |

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

Copy into `src/types/launchpad.ts`. Every endpoint’s response shape is also documented in [§16](#16-complete-api-response-reference).

```ts
// —— Shared ——
export type ApiErrorBody = { error: string; message: string };

export type JobStage = { key: string; label: string };

export type ConceptSummary = {
  industry?: string;
  audience?: string;
  productType?: string;
  geography?: string;
  summary?: string;
  [key: string]: unknown;
};

// —— Auth ——
export type AuthUser = { id: string; email: string };

export type AuthTokens = {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type MeResponse = {
  id: string;
  email: string;
  tier: string;
  pitch_count: number;
  campaign_count: number;
};

// —— Capture ——
export type CaptureResponse = {
  sessionId: string;
  conceptSummary: ConceptSummary;
  disclaimer: string;
};

// —— Scan ——
export type ScanResult = {
  opportunityRating: 'green' | 'amber' | 'red' | string;
  competitors: Array<{ name: string; description: string; funding: string }>;
  marketSize: string;
  uspGaps: string[];
  citations: string[];
};

// —— Audit ——
export type AuditRisk = {
  category: 'legal' | 'ethical' | 'operational' | string;
  description: string;
  severity: 'high' | 'medium' | 'low' | string;
  mitigation: string;
};

export type AuditResponse = {
  risks: AuditRisk[];
  citations: string[];
  disclaimer: string;
};

// —— Refine ——
export type RefineStartResponse = {
  questionIndex: number;
  question: string;
  audioUrl: string | null;
  done: false;
};

export type RefineAnswerNextResponse = {
  questionIndex: number;
  question: string;
  audioUrl: string | null;
  done: false;
};

export type RefineAnswerDoneResponse = {
  questionIndex: number;
  done: true;
};

export type RefineAnswerResponse = RefineAnswerNextResponse | RefineAnswerDoneResponse;

export type IdeaProfile = {
  customer: string;
  revenue: string;
  moat: string;
  gtm: string;
  founderFit: string;
};

export type RefineCompleteResponse = { ideaProfile: IdeaProfile };

export type RefineAnswerRecord = { question: string; answer: string };

// —— Validate ——
export type ViabilityScore = {
  overall: number;
  breakdown: {
    marketOpportunity: number;
    competitiveRisk: number;
    legalComplexity: number;
    differentiation: number;
  };
  summary: string;
};

// —— Pitch job start ——
export type PitchStartResponse = {
  jobId: string;
  status: 'processing';
  progress: 'queued';
  stages: JobStage[];
};

// —— Jobs poll ——
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

export type PitchSlideLayout = 'title' | 'bullets' | 'metric' | 'chart' | 'competition';

export type PitchSlide = {
  slide: number;
  layout?: PitchSlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  content?: string;
  speakerNotes?: string;
};

export type InvestorQAItem = { question: string; framework: string };

export type MarketingPack = {
  taglines: string[];
  heroCopy: string;
  socialPosts: { instagram?: string; linkedin?: string; twitter?: string; [k: string]: string };
  coldEmail: string;
  pressRelease: string;
  seoKeywords: string[];
};

export type PitchJobResult = {
  pitchDeck: PitchSlide[];
  investorQA: InvestorQAItem[];
  marketingPack?: MarketingPack;
  audioUrl: string | null;
  pdfUrl?: string | null;
  pdfFilename?: string;
  slideImageUrls?: Array<string | null>;
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
  referenceImageUrl: string | null;
};

// —— Campaign start ——
export type CampaignStartResponse = {
  jobId: string;
  campaignId: string;
  status: 'processing';
  progress: 'queued';
  referenceImageUrl: string | null;
  stages: JobStage[];
};

// —— Campaign history ——
export type CampaignListItem = {
  id: string;
  title: string;
  description: string;
  tone: 'energetic' | 'professional' | 'emotional' | 'funny' | string;
  status: 'processing' | 'done' | 'failed' | string;
  banner_url: string | null;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignListResponse = { campaigns: CampaignListItem[] };

// —— Combined history (Pitch + Campaign tabs) ——
export type HistoryResponse = {
  pitches: SessionListItem[];
  campaigns: CampaignListItem[];
};

export type CampaignRecord = {
  id: string;
  user_id: string;
  description: string;
  tone: string;
  status: string;
  ad_script: string | null;
  taglines: string[] | null;
  captions: { instagram?: string; tiktok?: string; twitter?: string } | null;
  email_copy: string | null;
  hero_copy: string | null;
  banner_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  product_url: string | null;
  reference_image_url: string | null;
  created_at: string;
  updated_at: string;
};

// —— Sessions ——
export type SessionListItem = {
  id: string;
  title: string;
  stage: string;
  concept_summary: ConceptSummary | null;
  created_at: string;
  updated_at: string;
};

export type SessionListResponse = { sessions: SessionListItem[] };

export type PitchOutput = {
  pitchDeck: PitchSlide[];
  investorQA: InvestorQAItem[];
  marketingPack?: MarketingPack;
  pdfUrl?: string | null;
  pdfFilename?: string;
  slideImageUrls?: Array<string | null>;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  stage: string;
  idea_raw: string | null;
  concept_summary: ConceptSummary | null;
  scan_result: ScanResult | null;
  scan_expires_at: string | null;
  audit_result: AuditRisk[] | { risks: AuditRisk[]; citations?: string[] } | null;
  refine_questions: string[] | null;
  refine_answers: RefineAnswerRecord[] | null;
  refine_index: number | null;
  idea_profile: IdeaProfile | null;
  viability_score: ViabilityScore | null;
  pitch_output: PitchOutput | null;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
};

export type DeleteResponse = { ok: true; deletedId: string };

export type BulkDeleteResponse = {
  ok: true;
  deletedCount: number;
  deletedIds: string[];
};

export type PdfExportResponse = {
  pdfUrl: string;
  pdfFilename: string;
};

export type HealthResponse = {
  status: string;
  timestamp: string;
  environment: string;
  mockAi: boolean;
  supabase: boolean;
  minimax: boolean;
  webSearch: string;
  imageProvider: string;
  ttsProvider: string;
};
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
| Combined history page | `GET /api/history` → `{ pitches, campaigns }` |
| Campaign history (separate call) | `GET /api/campaign` (list) + `GET /api/campaign/:id` (single) |
| Delete pitch | `DELETE /api/session/:id` (one) or `DELETE /api/session` (all) |
| Delete campaign | `DELETE /api/campaign/:id` (one) or `DELETE /api/campaign` (all) |
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
- [ ] Campaign form optional **reference image** uses `FormData` + `referenceImage` (or JSON `referenceImageUrl`)
- [ ] **Download PDF** uses `pdfUrl` (already includes `?download=` for a meaningful filename) or `GET /api/session/:id/export/pdf`
- [ ] Supabase **`exports`** bucket exists and is public (backend uploads `.pdf` there)
- [ ] History tab uses `GET /api/history` → renders **Pitched** and **Campaigns** tabs from `pitches` and `campaigns` keys
- [ ] History **delete** calls `DELETE /api/session/:id` (one) / `DELETE /api/session` (clear all) and `DELETE /api/campaign/:id` / `DELETE /api/campaign` and refreshes the list
- [ ] Campaign download uses `Content-Disposition` or `X-Filename` so the saved file is `LaunchPad-Campaign-<slug>-<date>.zip`
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
5. Campaign page: POST /api/campaign (multipart if reference photo), poll job, download ZIP
6. Campaign results: bannerUrl, captions, optional referenceImageUrl preview
7. Results from GET /api/session/:id — show pitchDeck, audio player, Download PDF (pdfUrl)
8. History page: GET /api/session list, open /pitch/:sessionId, DELETE to remove

Do NOT use /api/pitch/generate, /api/sessions, or status === "completed".
Map businessDescription → description for campaign.
Reference photo: FormData field referenceImage (max 5MB); do not set Content-Type on multipart fetch.
```

---

## 16. Complete API response reference

Use this section to wire UI components. Unless noted, responses are **JSON** with `Content-Type: application/json`. Errors use `{ "error": "CODE", "message": "..." }` (see [§12](#12-errors--edge-cases)).

### Health (no auth)

`GET /health` · `GET /api/health`

```json
{
  "status": "ok",
  "timestamp": "2026-05-16T12:00:00.000Z",
  "environment": "production",
  "mockAi": false,
  "supabase": true,
  "minimax": true,
  "webSearch": "minimax",
  "imageProvider": "minimax",
  "ttsProvider": "openai"
}
```

---

### Auth

#### `POST /api/auth/signup` · **201** (session) or **201** (confirm email)

**Request:** `{ "email", "password", "name?" }`

**With session (auto sign-in):**

```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "access_token": "eyJ...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

**Email confirmation required (no tokens):**

```json
{
  "message": "Check your email to confirm your account",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

#### `POST /api/auth/signin` · **200**

Same shape as signup with session (`user`, `access_token`, `refresh_token`, `expires_in`).

**401:** `{ "error": "SIGNIN_FAILED", "message": "..." }`

#### `GET /api/auth/me` · **200**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "tier": "free",
  "pitch_count": 0,
  "campaign_count": 0
}
```

#### `POST /api/auth/signout` · `POST /api/auth/logout` · **200**

```json
{ "ok": true, "message": "Logged out successfully" }
```

---

### Step 1 — Capture

#### `POST /api/capture` · **201**

**Request:** `{ "transcript": "string" }`

**Response:**

```json
{
  "sessionId": "uuid",
  "conceptSummary": {
    "industry": "EdTech",
    "audience": "Rural students",
    "productType": "AI tutoring platform",
    "geography": "Sri Lanka",
    "summary": "2-3 sentence summary of the idea"
  },
  "disclaimer": "AI-assisted analysis — not legal or financial advice."
}
```

**UI:** Save `sessionId`. Show `conceptSummary` fields. Display `disclaimer`.

---

### Step 2 — Scan

#### `POST /api/scan` · **200**

**Request:** `{ "sessionId": "uuid" }`

**Response body** (saved on session as `scan_result`; returned directly):

```json
{
  "opportunityRating": "green",
  "competitors": [
    { "name": "Competitor A", "description": "What they do", "funding": "Seed / Unknown" }
  ],
  "marketSize": "TAM/SAM/SOM or narrative market size string",
  "uspGaps": ["Gap 1", "Gap 2"],
  "citations": ["https://..."]
}
```

`opportunityRating`: use for badge color — `green` | `amber` | `red`.

**UI:** Market scan panel, competitor table, citation links. Cached 24h — repeat call returns same JSON without re-running search.

---

### Step 3 — Audit

#### `POST /api/audit` · **200**

**Request:** `{ "sessionId": "uuid" }`

**Response** (subset of full audit; full object also in `session.audit_result`):

```json
{
  "risks": [
    {
      "category": "legal",
      "description": "Risk description",
      "severity": "high",
      "mitigation": "How to mitigate"
    }
  ],
  "citations": ["https://..."],
  "disclaimer": "Surface-level AI scan — consult a qualified lawyer for legal decisions."
}
```

**UI:** Risk cards grouped by `category`; severity badge; show `disclaimer` prominently.

---

### Step 4 — Refine (founder interview)

#### `POST /api/refine/start` · **200**

**Request:** `{ "sessionId": "uuid" }`

**Response:**

```json
{
  "questionIndex": 0,
  "question": "Tailored interview question text?",
  "audioUrl": "https://....supabase.co/.../refine-q0.mp3",
  "done": false
}
```

`audioUrl` may be `null` if TTS failed — still show `question` text.

#### `POST /api/refine/answer` · **200**

**Request:** `{ "sessionId", "questionIndex": 0, "answerTranscript": "user spoken or typed answer" }`

**More questions** (`questionIndex` 1–4):

```json
{
  "questionIndex": 1,
  "question": "Next question?",
  "audioUrl": "https://....supabase.co/.../refine-q1.mp3",
  "done": false
}
```

**After 5th answer** (`questionIndex` becomes 5):

```json
{
  "questionIndex": 5,
  "done": true
}
```

(No `question` / `audioUrl` when `done: true` — call `/refine/complete` next.)

#### `POST /api/refine/complete` · **200**

**Request:** `{ "sessionId": "uuid" }`

**Response:**

```json
{
  "ideaProfile": {
    "customer": "Who buys and what problem",
    "revenue": "Business model",
    "moat": "Defensibility",
    "gtm": "Go-to-market",
    "founderFit": "Why this founder"
  }
}
```

**UI:** Profile summary cards before validate step.

---

### Step 5 — Validate

#### `POST /api/validate` · **200**

**Request:** `{ "sessionId": "uuid" }`

**Requires** `refine/complete` first. **400** `INVALID_STATE` if `idea_profile` missing.

**Response** (top-level object — not wrapped):

```json
{
  "overall": 74,
  "breakdown": {
    "marketOpportunity": 78,
    "competitiveRisk": 42,
    "legalComplexity": 30,
    "differentiation": 68
  },
  "summary": "Two-sentence viability summary."
}
```

**UI:** Score gauge from `overall` (0–100). Bar chart from `breakdown`. Note: lower `competitiveRisk` and `legalComplexity` = safer. Show `summary`.

---

### Step 6 — Start pitch job

#### `POST /api/pitch` · **202**

**Request:** `{ "sessionId": "uuid" }`

**Requires** `viability_score` on session. **400** if missing.

**Response:**

```json
{
  "jobId": "uuid",
  "status": "processing",
  "progress": "queued",
  "stages": [
    { "key": "queued", "label": "Queued" },
    { "key": "generating_content", "label": "Writing pitch deck, investor Q&A, and marketing copy…" },
    { "key": "generating_slide_images", "label": "Designing slide visuals…" },
    { "key": "generating_pdf", "label": "Building pitch deck PDF…" },
    { "key": "tts", "label": "Generating voiceover…" },
    { "key": "music", "label": "Creating background music…" },
    { "key": "mixing", "label": "Mixing audio…" },
    { "key": "uploading", "label": "Uploading pitch audio…" },
    { "key": "done", "label": "Complete" }
  ]
}
```

**UI:** Store `jobId`; open job polling screen with `stages` for stepper.

---

### Step 7 — Poll job

#### `GET /api/jobs/:jobId` · **200**

See [§6](#6-async-jobs--polling--progress-ui). While running: `status` is `queued` or `processing`, `result` is `null`.

**When `status === "done"`** — `result` for pitch:

```json
{
  "pitchDeck": [
    {
      "slide": 1,
      "layout": "title",
      "title": "Hook",
      "subtitle": "One-line tagline",
      "bullets": [],
      "content": "Slide narrative paragraph(s)",
      "speakerNotes": "What the founder says aloud"
    },
    {
      "slide": 2,
      "layout": "bullets",
      "title": "Problem",
      "subtitle": "Why this is broken today",
      "bullets": ["Pain 1", "Pain 2", "Pain 3"],
      "content": "Fallback paragraph if bullets empty",
      "speakerNotes": "Walk through the three pains"
    }
  ],
  "investorQA": [
    {
      "question": "Tough investor question?",
      "framework": "How to answer (talking points)"
    }
  ],
  "marketingPack": {
    "taglines": ["...", "...", "..."],
    "heroCopy": "Website hero text",
    "socialPosts": {
      "instagram": "...",
      "linkedin": "...",
      "twitter": "..."
    },
    "coldEmail": "Full email body",
    "pressRelease": "Press release text",
    "seoKeywords": ["keyword1", "keyword2"]
  },
  "audioUrl": "https://....supabase.co/storage/v1/object/public/audio/USER/pitch-SESSION.mp3",
  "pdfUrl": "https://....supabase.co/storage/v1/object/public/exports/USER/pitch-SESSION.pdf?download=LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf",
  "pdfFilename": "LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf",
  "slideImageUrls": [
    "https://....supabase.co/storage/v1/object/public/images/USER/pitch-SESSION-slide-1.png",
    null
  ],
  "audioWarning": "optional — present if voice failed but deck succeeded"
}
```

**When `status === "failed"`:**

```json
{
  "status": "failed",
  "error": "Human-readable error message",
  "result": null
}
```

#### `GET /api/jobs/stages/pitch` · `GET /api/jobs/stages/campaign` · **200**

```json
{
  "type": "pitch",
  "stages": [{ "key": "queued", "label": "Queued" }, ...]
}
```

---

### Step 8 — Full session (results / history detail)

#### `GET /api/session/:sessionId` · **200**

Returns **full** session row (snake_case DB fields):

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "stage": "pitched",
  "idea_raw": "original transcript",
  "concept_summary": { "industry": "...", "summary": "..." },
  "scan_result": { "opportunityRating": "amber", "competitors": [], "marketSize": "", "uspGaps": [], "citations": [] },
  "scan_expires_at": "ISO timestamp",
  "audit_result": { "risks": [], "citations": [] },
  "refine_questions": ["Q1?", "Q2?", "..."],
  "refine_answers": [{ "question": "...", "answer": "..." }],
  "refine_index": 5,
  "idea_profile": { "customer": "", "revenue": "", "moat": "", "gtm": "", "founderFit": "" },
  "viability_score": { "overall": 74, "breakdown": {}, "summary": "" },
  "pitch_output": {
    "pitchDeck": [],
    "investorQA": [],
    "marketingPack": {},
    "pdfUrl": "https://...?download=LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf",
    "pdfFilename": "LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf",
    "slideImageUrls": ["https://...slide-1.png", null]
  },
  "audio_url": "https://...mp3",
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

**UI mapping:** Prefer `pitch_output` / `audio_url` on session, or `job.result` right after job completes. Use `stage` for status badge on history list.

#### `GET /api/session` · **200** (pitch history only)

```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "AI Tutoring Platform",
      "stage": "pitched",
      "concept_summary": { "summary": "One line for card title" },
      "created_at": "ISO",
      "updated_at": "ISO"
    }
  ]
}
```

#### `GET /api/history` · **200** (Pitch + Campaign tabs)

```json
{
  "pitches": [
    {
      "id": "uuid",
      "title": "AI Tutoring Platform",
      "stage": "pitched",
      "concept_summary": { "summary": "..." },
      "created_at": "ISO",
      "updated_at": "ISO"
    }
  ],
  "campaigns": [
    {
      "id": "uuid",
      "title": "Small clothing brand in Colombo",
      "description": "Small clothing brand in Colombo focused on premium fabrics",
      "tone": "professional",
      "status": "done",
      "banner_url": "https://...",
      "audio_url": "https://...",
      "created_at": "ISO",
      "updated_at": "ISO"
    }
  ]
}
```

Use this for a unified `/history` page with two tabs. Each list is the same shape as the corresponding individual endpoint and is sorted by `updated_at` desc. Returns empty arrays when the user has no items yet (never `null`).

**`title` is always present** on every history item (both lists). Backend derives it once so the frontend renders proper labels like "AI Tutoring Platform" and "Small clothing brand in Colombo" instead of generic "Pitch 1 / Pitch 2".

#### `DELETE /api/session/:sessionId` · **200**

```json
{ "ok": true, "deletedId": "uuid" }
```

#### `DELETE /api/session` · **200** (bulk — current user)

```json
{ "ok": true, "deletedCount": 5, "deletedIds": ["uuid1", "uuid2"] }
```

Use for a “Clear pitch history” action. Idempotent — returns `deletedCount: 0` if nothing to delete.

#### `GET /api/session/:sessionId/export/pdf` · **200**

```json
{
  "pdfUrl": "https://...?download=LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf",
  "pdfFilename": "LaunchPad-Pitch-Deck-AI-Tutoring-2026-05-16.pdf"
}
```

`pdfUrl` already carries `?download=<pdfFilename>` — opening it triggers a download with the human-readable filename. Pass `?regenerate=1` to rebuild the PDF, or `?redirect=1` to receive a 302 to the file URL (useful for `<a download>`).

**409 NOT_READY** if the pitch deck has not been generated yet (run the pitch job first).

#### `GET /api/session/:sessionId/export/report` · **200**

Downloads a **JSON** file (`Content-Disposition: attachment`) containing the full session report. Use this when you need the structured data (concept, scan, audit, viability, pitch) outside of the rendered PDF. Body:

```json
{
  "title": "LaunchPad AI — Pitch Report",
  "disclaimer": "...",
  "concept": {},
  "scan": {},
  "audit": {},
  "ideaProfile": {},
  "viability": {},
  "pitch": {},
  "audioUrl": "https://...",
  "generatedAt": "ISO"
}
```

---

### Campaign mode

#### `POST /api/campaign` · **202**

**Request (JSON):**

```json
{
  "description": "Business description (required)",
  "tone": "professional",
  "productUrl": "https://optional.com",
  "referenceImageUrl": "https://optional-public-url/product.jpg"
}
```

**Request (multipart):** fields `description`, `tone`, optional `productUrl`, optional file field `referenceImage` (max 5MB).

`tone`: `energetic` | `professional` | `emotional` | `funny`

**Response:**

```json
{
  "jobId": "uuid",
  "campaignId": "uuid",
  "status": "processing",
  "progress": "queued",
  "referenceImageUrl": "https://....images/.../campaign-uuid-ref.jpg",
  "stages": [{ "key": "queued", "label": "Queued" }, ...]
}
```

`referenceImageUrl` is `null` when no reference image was sent.

Poll `GET /api/jobs/:jobId` until `done`.

**Campaign `stages` keys (in 202 + poll):** `queued` → `scraping_url` (if `productUrl`) → `generating_copy` → `generating_banner` → `generating_voice` → `generating_music` → `mixing_audio` → `generating_video` → `done`. See [§6](#6-async-jobs--polling--progress-ui).

**Campaign `result`:**

```json
{
  "campaignId": "uuid",
  "adScript": "30-second ad script text",
  "taglines": ["Tagline 1", "Tagline 2", "Tagline 3"],
  "captions": {
    "instagram": "Caption text",
    "tiktok": "Caption text",
    "twitter": "Caption text"
  },
  "emailCopy": "Email marketing body",
  "heroCopy": "Landing page hero",
  "bannerUrl": "https://....images/.../banner.png",
  "audioUrl": "https://....audio/.../campaign.mp3",
  "videoUrl": null,
  "referenceImageUrl": "https://....images/.../campaign-uuid-ref.jpg"
}
```

#### `GET /api/campaign` · **200** (history list)

```json
{
  "campaigns": [
    {
      "id": "uuid",
      "title": "Small clothing brand in Colombo",
      "description": "Small clothing brand in Colombo focused on premium fabrics",
      "tone": "professional",
      "status": "done",
      "banner_url": "https://....images/.../banner.png",
      "audio_url": "https://....audio/.../campaign.mp3",
      "created_at": "ISO",
      "updated_at": "ISO"
    }
  ]
}
```

Sorted by `updated_at` desc. Returns `{ "campaigns": [] }` when the user has no campaigns yet.

#### `GET /api/campaign/:campaignId` · **200** (full campaign row)

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "description": "Small clothing brand in Colombo",
  "tone": "professional",
  "status": "done",
  "ad_script": "30-second ad script text",
  "taglines": ["Tagline 1", "Tagline 2", "Tagline 3"],
  "captions": {
    "instagram": "...",
    "tiktok": "...",
    "twitter": "..."
  },
  "email_copy": "Email marketing body",
  "hero_copy": "Landing page hero",
  "banner_url": "https://....images/.../banner.png",
  "audio_url": "https://....audio/.../campaign.mp3",
  "video_url": null,
  "product_url": "https://example.com",
  "reference_image_url": "https://....images/.../campaign-uuid-ref.jpg",
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

`403` if the campaign belongs to another user, `404` if it does not exist.

#### `GET /api/campaign/:campaignId/download` · **200**

**Binary ZIP** (`Content-Type: application/zip`) — not JSON. Contains `campaign.json` (includes `bannerUrl`, `referenceImageUrl`, etc.), `ad-script.txt`, `email.txt`, `hero-copy.txt`.

**Filename:** Backend sets `Content-Disposition: attachment; filename="LaunchPad-Campaign-<slug>-2026-05-16.zip"` where `<slug>` comes from the campaign’s `description`. The same string is also returned as `X-Filename` so the frontend can read it via `fetch().headers.get('X-Filename')` after the blob is loaded. `Content-Disposition` and `X-Filename` are CORS-exposed.

**UI options:**

- **Easiest** — direct download via `<a download>` or `window.location`: the browser uses `Content-Disposition` automatically.
- **Fetch blob** — pass the filename to `saveAs(blob, filename)`:

```ts
async function downloadCampaign(campaignId: string) {
  const res = await fetch(`${API}/api/campaign/${campaignId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const filename =
    res.headers.get('X-Filename') ||
    `LaunchPad-Campaign-${campaignId}.zip`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### `DELETE /api/campaign/:campaignId` · **200**

```json
{ "ok": true, "deletedId": "uuid" }
```

#### `DELETE /api/campaign` · **200** (bulk — current user)

```json
{ "ok": true, "deletedCount": 3, "deletedIds": ["uuid1", "uuid2", "uuid3"] }
```

Use for a “Clear campaign history” action. Works without a `GET /api/campaign` list — the backend operates on the authenticated user. Idempotent.

---

### UI component checklist (outputs → widgets)

| API output | Suggested UI |
|------------|----------------|
| `conceptSummary` | Idea summary card / hero |
| `scan.opportunityRating` | Green/amber/red badge |
| `scan.competitors[]` | Table: name, description, funding |
| `scan.uspGaps[]` | Bullet list |
| `audit.risks[]` | Risk cards with severity chips |
| `refine` Q&A | Voice/text interview stepper |
| `ideaProfile` | 5-field profile grid |
| `viability.overall` | Large score + `summary` |
| `viability.breakdown` | 4-metric bars |
| `pitchDeck[]` | Layout-aware slide carousel (`title` / `bullets` / `metric` / `chart` / `competition`) with presenter mode + speaker notes |
| `slideImageUrls[]` | Per-slide background image with dark overlay; fall back to gradient when `null` |
| `pitchDeck[i].speakerNotes` | Presenter-mode notes panel (hidden from audience view) |
| `investorQA[]` | Accordion Q + “how to answer” |
| `marketingPack` | Tabs: taglines, social, email, SEO |
| `audioUrl` / `audio_url` | `<audio controls src={url}>` |
| `pdfUrl` | Download PDF button (filename comes from `?download=` so use as-is) |
| `pdfFilename` | Display string when showing what was saved (e.g. “Saved as `LaunchPad-Pitch-Deck-...pdf`”) |
| `job` poll fields | Progress bar + step labels |
| `sessions[]` / `pitches[]` | History list cards — use `item.title` as the heading (already human-readable) + `DELETE /api/session` button (“Clear all”) with confirm dialog |
| Campaign form | `description`, `tone`, optional `productUrl`, optional file → `referenceImage` |
| Campaign `result` | Ad preview, **`bannerUrl`** img, captions tabs; optional **`referenceImageUrl`** (“your upload”) |
| Campaign history list (`GET /api/campaign`) | History cards with `item.title` heading, `tone` chip, `banner_url` thumbnail, `status` badge |
| Single campaign (`GET /api/campaign/:id`) | Results page (same fields as `job.result`, persisted on the row) |
| Campaign delete | `DELETE /api/campaign/:id` (single) and `DELETE /api/campaign` (clear all) |

---

## Backend contact / repo files

If you need raw HTTP examples: `launchpad-backend/demo.http`

Backend maintainers: deploy latest `launchpad-backend` to Railway before testing new job fields.

**Questions?** Ping the backend team with: endpoint path, request body, response status, and `jobId` if applicable.
