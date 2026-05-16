# LaunchPad AI — Frontend Team Guide

Quick reference for building the Vite/React client against the `launchpad-backend` API.

**Full backend docs:** [PROJECT.md](PROJECT.md) · **Deploy checklist:** [launchpad-backend/DEPLOY.md](launchpad-backend/DEPLOY.md)

---

## 1. Environment

| Variable | Where | Value |
|----------|--------|--------|
| `VITE_API_URL` | Vercel / `.env.local` | `https://YOUR-APP.up.railway.app` (no trailing slash) |

**Supabase (client):** use the **anon** key only for auth UI if you talk to Supabase directly. All AI and file generation go through the backend — never put `MINIMAX_API_KEY`, `OPENAI_API_KEY`, or `SUPABASE_SERVICE_KEY` in the frontend.

**Railway:** ask backend to add your Vercel URL to `CORS_ORIGIN` (comma-separated). Local Vite (`http://localhost:5173`) is allowed automatically.

**Verify API:**

```bash
curl https://YOUR-APP.up.railway.app/health
```

---

## 2. Auth

```js
const API = import.meta.env.VITE_API_URL;

async function signIn(email, password) {
  const res = await fetch(`${API}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).message || 'Sign in failed');
  const { access_token } = await res.json();
  return access_token;
}

function api(path, options = {}, token) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.message || r.statusText), { status: r.status, ...data });
    return data;
  });
}
```

**Suggested `localStorage` keys**

| Key | Purpose |
|-----|---------|
| `launchpad_token` | `access_token` from sign-in |
| `launchpad_sessionId` | Current pitch session |
| `launchpad_jobId` | Active async job (pitch or campaign) |

On **401**, clear the token and redirect to login.

---

## 3. Pitch Mode — flow

Singular route prefix: **`/api/session`** (not `/api/sessions`).

```txt
capture → scan → audit → refine (5 Q&A) → validate → pitch (async job)
```

| Step | Method | Body | Notes |
|------|--------|------|--------|
| 1. Capture | `POST /api/capture` | `{ "transcript": "..." }` | Returns `sessionId`. Use **`transcript`** only — not `idea`. |
| 2. Scan | `POST /api/scan` | `{ "sessionId" }` | Market research; cached ~24h |
| 3. Audit | `POST /api/audit` | `{ "sessionId" }` | |
| 4a. Refine start | `POST /api/refine/start` | `{ "sessionId" }` | 5 questions |
| 4b. Refine answer | `POST /api/refine/answer` | `{ "sessionId", "questionIndex", "answerTranscript" }` | Repeat ×5 |
| 4c. Refine complete | `POST /api/refine/complete` | `{ "sessionId" }` | |
| 5. Validate | `POST /api/validate` | `{ "sessionId" }` | Viability score |
| 6. Pitch | `POST /api/pitch` | `{ "sessionId" }` | **202** + `jobId` — poll job |

Load full session anytime: `GET /api/session/:id`

List sessions: `GET /api/session`  
History (pitches + campaigns): `GET /api/history`

---

## 4. Async jobs (pitch & campaign)

After `POST /api/pitch` or `POST /api/campaign` you get **202**:

```json
{
  "jobId": "...",
  "status": "processing",
  "progress": "queued",
  "stages": [{ "key": "queued", "label": "Queued" }, ...]
}
```

Poll until `status` is `done` or `failed`:

```js
async function pollJob(jobId, token) {
  for (;;) {
    const job = await api(`/api/jobs/${jobId}`, {}, token);
    if (job.status === 'done') return job.result;
    if (job.status === 'failed') throw new Error(job.error || 'Job failed');
    // Use job.progressLabel + job.progressPercent for UI
    await new Promise((r) => setTimeout(r, 2000));
  }
}
```

Terminal statuses are **`done`** and **`failed`** — not `completed`.

### Pitch job stages (current)

| `progress` key | UI label (from API) |
|----------------|---------------------|
| `queued` | Queued |
| `generating_content` | Writing pitch deck, investor Q&A, and marketing copy… |
| `generating_slide_images` | Designing slide visuals… |
| `tts` | Generating voiceover… |
| `music` | Creating background music… |
| `mixing` | Mixing audio… |
| `uploading` | Uploading pitch audio… |
| `done` | Complete |

There is **no** `generating_pdf` stage anymore.

### Pitch job `result` (when `done`)

```json
{
  "pitchDeck": [ /* 10 slides — see below */ ],
  "investorQA": { /* ... */ },
  "marketingPack": { /* ... */ },
  "slideImageUrls": ["https://...", null, "..."],
  "audioUrl": "https://.../audio/.../pitch-{sessionId}.mp3",
  "audioWarning": "optional string if TTS/mix failed"
}
```

Same fields are persisted on the session as `pitch_output` (plus `audio_url` at session root).

**`audioUrl` may be `null`** — still show deck text, Q&A, and marketing. Surface `audioWarning` if present.

---

## 5. Pitch deck UI (JSON + images)

Render slides in-app from `pitch_output.pitchDeck` (or `job.result.pitchDeck`).

Example slide shape:

```json
{
  "slide": 1,
  "layout": "title",
  "title": "...",
  "subtitle": "...",
  "bullets": ["...", "..."],
  "content": "...",
  "speakerNotes": "..."
}
```

`layout` values include: `title`, `bullets`, `chart`, and others — handle unknown layouts gracefully.

**Slide images:** `pitch_output.slideImageUrls[i]` matches `pitchDeck[i]`. Entries can be `null` if image generation failed — fall back to text-only styling.

---

## 6. Downloads & exports

### Removed: PDF

- **`GET /api/session/:id/export/pdf`** — **removed**. Do not link to it.
- Do not read `pdfUrl` / `pdfFilename` on new sessions (legacy rows may still have them — ignore).

### PowerPoint (on demand)

`GET /api/session/:id/export/pptx`

| Query | Behavior |
|-------|----------|
| *(none)* | Streams `.pptx` file (attachment) |
| `json=1` | `{ "pptxUrl", "pptxFilename", "cached"?: true }` — use URL for download button |
| `redirect=1` | Redirect to stored file when cached |
| `regenerate=1` | Force rebuild even if `pptxUrl` exists |

Requires pitch job complete (`pitch_output.pitchDeck` non-empty). Errors: `400 NOT_READY`, `500 EXPORT_FAILED`.

Example download button:

```js
const url = `${API}/api/session/${sessionId}/export/pptx?redirect=1`;
window.location.href = url; // needs Authorization — prefer fetch + blob or json=1 URL
```

For authenticated download in SPA, prefer:

```js
const { pptxUrl } = await api(
  `/api/session/${sessionId}/export/pptx?json=1`,
  {},
  token
);
if (pptxUrl) window.open(pptxUrl, '_blank');
```

Or fetch with `Authorization` and save blob from the stream response.

### JSON report

`GET /api/session/:id/export/report` — full session bundle as downloadable JSON.

---

## 7. Campaign Mode

| Step | Method | Notes |
|------|--------|--------|
| Create | `POST /api/campaign` | **202** + `jobId` |

**JSON body:**

```json
{
  "description": "required",
  "tone": "energetic | professional | emotional | funny",
  "productUrl": "optional",
  "referenceImageUrl": "optional public URL"
}
```

**Multipart:** same fields + optional `referenceImage` file (max 5MB, image/*).

Poll job → `result` includes `adScript`, `taglines`, `captions`, `emailCopy`, `heroCopy`, `bannerUrl`, `audioUrl`, `referenceImageUrl`.

**`videoUrl` is always `null`** — do not build promo-video UI.

ZIP download: `GET /api/campaign/:id/download`

---

## 8. UI rules (do / don’t)

| Do | Don’t |
|----|--------|
| Call only `VITE_API_URL` for API + jobs | Call MiniMax/OpenAI from the browser |
| Send `transcript` on capture | Send `idea` as the field name |
| Poll `GET /api/jobs/:jobId` until `done` / `failed` | Assume pitch/campaign finishes in one request |
| Show progress via `progressLabel` / `progressPercent` | Hard-code old stage keys like `generating_pdf` |
| Render deck from `pitchDeck` + `slideImageUrls` | Depend on PDF export |
| Use PPTX endpoint or in-app slides for “download deck” | Use removed PDF endpoint |
| Handle missing `audioUrl` gracefully | Block the results screen when audio fails |
| Clear token on 401 | Expose service keys in env |

---

## 9. Common API errors

| Status | `error` | Meaning |
|--------|---------|---------|
| 400 | `VALIDATION` | Missing/invalid body |
| 400 | `INVALID_STATE` | Wrong pipeline order (e.g. pitch before validate) |
| 400 | `NOT_READY` | PPTX before pitch job completes |
| 401 | — | Missing/expired token |
| 403 | — | Not owner of session/campaign |
| 500 | `EXPORT_FAILED` | PPTX generation failed |

---

## 10. Health check (optional UI / debug)

`GET /health` or `GET /api/health` (no auth):

```json
{
  "ok": true,
  "mockAi": false,
  "supabase": true,
  "minimax": true,
  "openai": true,
  "pitchLlmProvider": "openai",
  "ttsProvider": "openai",
  "imageProvider": "minimax"
}
```

---

## 11. Checklist before demo

- [ ] `VITE_API_URL` set on Vercel
- [ ] Frontend origin in Railway `CORS_ORIGIN`
- [ ] Supabase auth redirect URLs include your Vercel domain
- [ ] Sign-in works in browser (not just curl)
- [ ] Pitch job progress UI matches current stages (no PDF step)
- [ ] Deck download uses **PPTX** or in-app viewer — not PDF
- [ ] No “download video” or PDF buttons

---

*Last updated: May 2026 — PDF export removed; PPTX on-demand via `/api/session/:id/export/pptx`.*
