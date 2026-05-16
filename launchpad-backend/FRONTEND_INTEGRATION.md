# LaunchPad API — Frontend integration guide

**For frontend team.** This is the contract for the live backend. It replaces the simplified paths in `launchpad_api_endpoints_deep.md` where they differ.

**Why the API is designed this way:** see [FRONTEND_API_RATIONALE.md](./FRONTEND_API_RATIONALE.md).  
**Mapping your screens to these calls:** see [FRONTEND_UI_API_MAPPING.md](./FRONTEND_UI_API_MAPPING.md).

## Base URL

| Environment | URL |
|-------------|-----|
| **Production (Railway)** | `https://buildathon-production-c28b.up.railway.app` |
| **Local** | `http://localhost:3000` |

## Frontend env

```env
VITE_API_URL=https://buildathon-production-c28b.up.railway.app
```

Use `${VITE_API_URL}/api/...` for all API calls. Do **not** put MiniMax, Tavily, or Supabase service keys in the frontend.

---

## Auth (required)

Almost every route needs a JWT from sign-in.

### Sign up

```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "testpassword123",
  "name": "Optional"
}
```

### Sign in

```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "testpassword123"
}
```

**Response (200/201):**

```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "access_token": "eyJ...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

Store `access_token` (e.g. `localStorage`) and send on all protected requests:

```http
Authorization: Bearer <access_token>
```

### Current user

```http
GET /api/auth/me
Authorization: Bearer <token>
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

### Logout (yes — use this in the UI)

```http
POST /api/auth/signout
Authorization: Bearer <token>
```

Also supported: `POST /api/auth/logout` (alias).

**Response:** `{ "ok": true }`

**Frontend must also:**

1. Remove `access_token` from memory / `localStorage`
2. Redirect to login or home
3. (Optional) If you use Supabase client on the frontend, call `supabase.auth.signOut()` as well

The backend does not maintain a server-side session cookie; logout is **client-driven** after clearing the token.

---

## Health

```http
GET /health
GET /api/health
```

No auth. Example:

```json
{
  "status": "ok",
  "environment": "production",
  "mockAi": false,
  "supabase": true,
  "minimax": true,
  "tavily": true,
  "imageProvider": "minimax"
}
```

---


---

## Pitch Mode — recommended flow

There is **no** single `POST /api/pitch/generate`. Run these in order (show a stepper in the UI).

| Step | Method | Path | Body |
|------|--------|------|------|
| 1 | POST | `/api/capture` | `{ "transcript": "..." }` |
| 2 | POST | `/api/scan` | `{ "sessionId": "..." }` |
| 3 | POST | `/api/audit` | `{ "sessionId": "..." }` |
| 4 | POST | `/api/refine/start` | `{ "sessionId": "..." }` |
| 5 | POST | `/api/refine/answer` | `{ "sessionId", "questionIndex": 0–4, "answerTranscript" }` |
| 6 | POST | `/api/refine/complete` | `{ "sessionId": "..." }` |
| 7 | POST | `/api/validate` | `{ "sessionId": "..." }` |
| 8 | POST | `/api/pitch` | `{ "sessionId": "..." }` → **202** + `jobId` |
| 9 | GET | `/api/jobs/:jobId` | Poll until `status` is `completed` or `failed` |
| 10 | GET | `/api/session/:sessionId` | Full session JSON |

All steps except sign-up/sign-in require `Authorization: Bearer <token>`.

### Field mapping from your spec

```js
// Map your pitch form to capture:
const transcript = [
  payload.idea,
  payload.country && `Country: ${payload.country}`,
  payload.industry && `Industry: ${payload.industry}`,
  payload.founderContext && `Founder: ${payload.founderContext}`,
].filter(Boolean).join('\n');

await apiPost('/api/capture', { transcript });
```

### Capture response (201)

```json
{
  "sessionId": "uuid",
  "conceptSummary": { },
  "disclaimer": "AI-assisted analysis — not legal or financial advice."
}
```

### Pitch job (202)

```json
{
  "jobId": "uuid",
  "status": "processing"
}
```

### Poll job

```http
GET /api/jobs/:jobId
```

```json
{
  "jobId": "uuid",
  "type": "pitch",
  "status": "processing | completed | failed",
  "progress": "string",
  "result": { },
  "error": null
}
```

Poll every 2–3s until `completed` or `failed`.

### Minimum demo (if short on time)

`signin` → `capture` → `validate` (skip scan/audit/refine if needed) → `pitch` → poll job.

---

## Campaign Mode

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

`tone`: `energetic` | `professional` | `emotional` | `funny`

**Response (202):**

```json
{
  "jobId": "uuid",
  "campaignId": "uuid",
  "status": "processing"
}
```

Poll `GET /api/jobs/:jobId`, then download:

```http
GET /api/campaign/:campaignId/download
```

Returns a ZIP when `status` is `done`.

Map `businessDescription` → `description`.

---

## Sessions

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/session` | List current user's sessions |
| GET | `/api/session/:id` | Get one session (all stages + outputs) |
| GET | `/api/session/:id/export/pdf` | JSON report download (not PDF binary) |

No `POST /api/sessions` — saving happens automatically during the pipeline.

---

## Errors

```json
{
  "error": "VALIDATION",
  "message": "Human-readable message"
}
```

Show `message` in the UI. Common codes: `VALIDATION`, `UNAUTHORIZED`, `SIGNIN_FAILED`, `INVALID_STATE`, `NOT_FOUND`, `INTERNAL_ERROR`.

HTTP status: 400 validation, 401 auth, 403 forbidden, 404 not found, 202 async accepted, 500 server.

---

## CORS

Backend allows origins from Railway env `CORS_ORIGIN` (comma-separated). Ask backend to add:

```txt
http://localhost:5173
https://your-app.vercel.app
```

---

## Example `apiClient.ts`

```ts
const BASE = import.meta.env.VITE_API_URL;

export function getToken() {
  return localStorage.getItem('launchpad_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('launchpad_token', token);
  else localStorage.removeItem('launchpad_token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
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

## Supabase (frontend)

You may use public anon key only for optional direct auth UI. **Pipeline calls go through this backend**, not MiniMax/Tavily from the browser.

Add Railway + Vercel URLs to Supabase Auth → Redirect URLs.

---

## Questions?

Backend: `README.md`, `demo.http`, `PRODUCTION.md` in `launchpad-backend/`.
