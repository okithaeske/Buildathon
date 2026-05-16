# LaunchPad — UI ↔ API mapping guide

**For frontend + Cursor.** Use this file with your React pages/components.

Read first: [`FRONTEND_API_RATIONALE.md`](./FRONTEND_API_RATIONALE.md) (why).  
HTTP details: [`FRONTEND_INTEGRATION.md`](./FRONTEND_INTEGRATION.md) (what).

**Do not use** `launchpad_api_endpoints_deep.md` for URLs — it describes a different (simpler) API shape.

---

## Quick setup

```env
# .env (Vite)
VITE_API_URL=https://buildathon-production-c28b.up.railway.app
```

```ts
// localStorage keys (suggested)
launchpad_token      // access_token from signin
launchpad_sessionId  // current pitch session
launchpad_jobId      // current async job (pitch or campaign)
```

---

## How to use in Cursor

1. Open the **frontend** repo in Cursor.
2. Attach:
   - `@launchpad-backend/FRONTEND_UI_API_MAPPING.md` (this file)
   - `@launchpad-backend/FRONTEND_INTEGRATION.md` (API contract)
   - Your UI files, e.g. `@src/pages/Pitch.tsx`, `@src/App.tsx`
3. Prompt example:

```text
Wire my existing UI to the backend using FRONTEND_UI_API_MAPPING.md
and FRONTEND_INTEGRATION.md. Do not use /api/pitch/generate or
/api/sessions. Implement signin, logout, multi-step pitch pipeline
with progress UI, and job polling.
```

---

## App routes → API (overview)

| Route (your UI) | Purpose | API when user acts |
|-----------------|---------|-------------------|
| `/` | Landing / mode pick | `GET /health` (optional banner) |
| `/login` | Sign in | `POST /api/auth/signin` |
| `/signup` | Register | `POST /api/auth/signup` |
| `/pitch` | Enter idea + run pipeline | See **Pitch flow** below |
| `/pitch/result` or `/pitch/:sessionId` | Show outputs | `GET /api/session/:id` |
| `/campaign` | Campaign mode | See **Campaign flow** below |
| `/history` or `/sessions` | Past pitches | `GET /api/session` |

Protect `/pitch`, `/campaign`, `/history` — redirect to `/login` if no token.

---

## Global UI elements

| UI element | API / logic |
|------------|-------------|
| **App shell load** | `GET /health` — show “API connected” if `status === 'ok'` |
| **Nav: user email** | `GET /api/auth/me` on load (if token exists) |
| **Nav: Log out** | `POST /api/auth/signout` then `localStorage.removeItem('launchpad_token')` → `/login` |
| **401 on any call** | Clear token → redirect `/login` |
| **Error toast** | Show `response.message` from `{ error, message }` |

---

## Auth screens

### Login page (`/login`)

| User action | API |
|-------------|-----|
| Submit email + password | `POST /api/auth/signin` |
| Success | Save `access_token` → redirect `/pitch` |
| Link to sign up | Navigate `/signup` |

### Sign up page (`/signup`)

| User action | API |
|-------------|-----|
| Submit form | `POST /api/auth/signup` |
| Returns `access_token` | Save token → `/pitch` |
| Returns “check email” only | Show message (no token yet) |

### Logout (any page)

| User action | API |
|-------------|-----|
| Click **Log out** | `POST /api/auth/signout` (Bearer token) |
| Always | Remove `launchpad_token`, clear `sessionId` / `jobId` → `/login` |

**Yes, include logout** — required for a complete app.

---

## Pitch Mode — UI flow

Your spec imagined **one** “Generate” button → `POST /api/pitch/generate`.

Our backend uses a **wizard / stepper**. Map your UI like this:

### Option A — Full demo (best for judges)

Show a progress stepper while calling APIs in sequence:

| Step # | Label in UI | API | Save to state |
|--------|-------------|-----|----------------|
| 1 | Capturing idea… | `POST /api/capture` | `sessionId`, `conceptSummary` |
| 2 | Scanning market… | `POST /api/scan` | `marketScan` |
| 3 | Auditing risks… | `POST /api/audit` | `riskRegister` |
| 4 | Founder interview… | `POST /api/refine/start` | `questions[]` |
| 5 | Questions 1–5 | `POST /api/refine/answer` ×5 | — |
| 6 | Building profile… | `POST /api/refine/complete` | `ideaProfile` |
| 7 | Scoring viability… | `POST /api/validate` | `viabilityScore` |
| 8 | Generating pitch… | `POST /api/pitch` | `jobId` |
| 9 | Finalizing deck… | `GET /api/jobs/:jobId` (poll) | `pitchDeck`, `investorQA`, `audioUrl` |
| 10 | Done | `GET /api/session/:sessionId` | full session for dashboard |

### Option B — Minimum demo (time tight)

| Step | API |
|------|-----|
| 1 | `capture` |
| 2 | `validate` (may fail if refine skipped — then do refine or mock refine answers) |
| 3 | `pitch` → poll job |
| 4 | Show results |

**Note:** `POST /api/pitch` requires `viability_score` on session (from `validate`). `validate` requires `idea_profile` (from `refine/complete`). Minimum path still needs **refine** or backend will return `INVALID_STATE`.

**Practical minimum:** capture → refine (start + 5 answers + complete) → validate → pitch → poll.

---

## Pitch page (`/pitch`) — form → API

### If your form matches the old spec

| Form field (old doc) | Send to API as |
|----------------------|----------------|
| `idea` | Part of `transcript` |
| `country` | Append to `transcript`: `Country: …` |
| `industry` | Append: `Industry: …` |
| `founderContext` | Append: `Founder: …` |
| `outputTone` | Append: `Tone: …` (optional) |

```ts
function buildTranscript(form: PitchForm) {
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

// Step 1
const { sessionId, conceptSummary } = await api.post('/api/capture', {
  transcript: buildTranscript(form),
});
```

### Single textarea UI

If you only have one big text box → send it as `{ transcript: value }`.

### “Generate pitch” button

**Do not** call `/api/pitch/generate`.

Either:

- **Wizard:** run the full pipeline (table above), or  
- **One button:** run `runPitchPipeline(sessionId)` that chains calls in `src/services/pitchPipeline.ts`.

---

## Refine / interview UI

After `refine/start`, show questions one at a time or as a form:

| UI | API body |
|----|----------|
| Question 1 answer | `{ sessionId, questionIndex: 0, answerTranscript: "..." }` |
| Question 2 | `questionIndex: 1` |
| … | up to `4` |
| Finish interview | `POST /api/refine/complete` `{ sessionId }` |

Use `answerTranscript` (string), not `answer`.

---

## Results dashboard (`/pitch/result` or `/pitch/:sessionId`)

Load once when page opens (and after job completes):

```http
GET /api/session/:sessionId
Authorization: Bearer <token>
```

### Map API fields → UI sections

| UI section (from old spec) | Session / job field |
|----------------------------|---------------------|
| Concept summary | `concept_summary` |
| Clarifying questions | `refine_questions` |
| Market scan | `scan_result` |
| Risk register | `audit_result` |
| Viability score | `viability_score` |
| Pitch deck slides | `pitch_output.pitchDeck` or `job.result.pitchDeck` |
| Investor Q&A | `pitch_output.investorQA` or `job.result.investorQA` |
| Marketing pack | `job.result.marketingPack` (if present) |
| Pitch audio player | `audio_url` or `job.result.audioUrl` |

### localStorage backup (optional)

```ts
localStorage.setItem('launchpad:lastPitchResult', JSON.stringify(session));
```

---

## Async job UI (pitch + campaign)

After `POST /api/pitch` or `POST /api/campaign`:

```ts
async function pollJob(jobId: string, onProgress?: (p: string) => void) {
  for (let i = 0; i < 120; i++) {
    const job = await api.get(`/api/jobs/${jobId}`);
    onProgress?.(job.progress);
    if (job.status === 'completed') return job.result;
    if (job.status === 'failed') throw new Error(job.error || 'Job failed');
    await sleep(2500);
  }
  throw new Error('Timed out');
}
```

| `job.status` | UI |
|--------------|-----|
| `processing` / `queued` | Spinner + `progress` text |
| `completed` | Navigate to results / render `result` |
| `failed` | Error message + retry |

---

## Campaign page (`/campaign`)

| UI | API |
|----|-----|
| Submit business form | `POST /api/campaign` |
| Field `businessDescription` | Send as `description` |
| Field `productUrl` | `productUrl` |
| Field `tone` | `tone` (`energetic` \| `professional` \| `emotional` \| `funny`) |
| Field `platform` | **Not in API** — append to `description` if needed |
| Loading | Poll `GET /api/jobs/:jobId` |
| Download pack | `GET /api/campaign/:campaignId/download` (ZIP) |

Display from job `result` or unzip manifest: taglines, captions, email, ad script, banner URL, etc.

---

## History page (`/sessions` or sidebar)

| UI | API |
|----|-----|
| List cards | `GET /api/session` → `{ sessions: [...] }` |
| Click row | Navigate `/pitch/:id` → `GET /api/session/:id` |

There is no `DELETE` session endpoint.

---

## Suggested React structure

```txt
src/
  lib/
    apiClient.ts       # fetch + Bearer + errors
  services/
    authService.ts     # signin, signup, signout, me
    pitchService.ts    # capture, scan, audit, refine, validate, pitch
    campaignService.ts
    jobService.ts      # pollJob
  hooks/
    useAuth.ts
    usePitchPipeline.ts
  pages/
    LoginPage.tsx
    SignupPage.tsx
    PitchPage.tsx      # form + stepper
    PitchResultPage.tsx
    CampaignPage.tsx
    HistoryPage.tsx
```

---

## Old endpoint doc → real API (cheat sheet)

| They designed | You implement |
|---------------|---------------|
| `GET /api/health` | `GET /health` or `GET /api/health` |
| `POST /api/pitch/generate` | Full pipeline (this doc) |
| `POST /api/pitch/summary` | `POST /api/capture` |
| `POST /api/pitch/questions` | `POST /api/refine/start` |
| `POST /api/pitch/market-scan` | `POST /api/scan` |
| `POST /api/pitch/risk-audit` | `POST /api/audit` |
| `POST /api/pitch/viability-score` | `POST /api/validate` |
| `POST /api/pitch/deck` | `POST /api/pitch` + job poll |
| `POST /api/campaign/generate` | `POST /api/campaign` + job poll |
| `GET /api/sessions/:id` | `GET /api/session/:id` |
| `POST /api/auth/logout` | `POST /api/auth/signout` or `/logout` |

---

## TypeScript state shape (suggested)

```ts
type AppAuth = {
  token: string | null;
  user: { id: string; email: string; tier?: string } | null;
};

type PitchWizardState = {
  sessionId: string | null;
  step: 'idle' | 'capture' | 'scan' | 'audit' | 'refine' | 'validate' | 'pitch' | 'done';
  conceptSummary?: unknown;
  marketScan?: unknown;
  riskRegister?: unknown;
  questions?: unknown[];
  viabilityScore?: unknown;
  jobId?: string | null;
  pitchResult?: unknown;
};
```

---

## Mock mode (frontend only)

If backend is down during UI work:

```env
VITE_USE_MOCK_API=true
```

When `true`, skip `fetch` and return fake JSON after 1–2s. **Turn off for final demo** — use real Railway URL.

---

## Checklist before demo

- [ ] `VITE_API_URL` points to Railway
- [ ] Sign in works; token stored
- [ ] Log out clears token
- [ ] Pitch pipeline shows progress (not one silent wait)
- [ ] Results page reads `GET /api/session/:id`
- [ ] Campaign polls job + download ZIP
- [ ] CORS: backend `CORS_ORIGIN` includes your Vercel URL
- [ ] Supabase redirect URLs include frontend + Railway

---

## Related docs

| File | Use for |
|------|---------|
| [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) | Exact HTTP bodies, auth, errors |
| [demo.http](./demo.http) | Copy-paste requests (VS Code REST Client) |
| [README.md](./README.md) | Full endpoint table |
| `launchpad_api_endpoints_deep.md` (repo root) | Product/UX ideas only — **not** live API paths |
