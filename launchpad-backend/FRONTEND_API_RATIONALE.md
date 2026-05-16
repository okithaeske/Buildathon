# Why the frontend should use the backend API this way

**Audience:** Frontend developers, designers, and anyone wiring the LaunchPad UI in Cursor.

This document explains **rationale** — not just *what* to call, but *why* the backend is shaped this way and how that should influence your UI.

For implementation details, use:

- [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) — HTTP contract
- [FRONTEND_UI_API_MAPPING.md](./FRONTEND_UI_API_MAPPING.md) — page-by-page mapping

---

## 1. Core principle: frontend is a thin client

```txt
Browser  →  Our Node API (Railway)  →  MiniMax (+ web search) / Supabase
```

**Rationale:**

- AI keys and billing live on the server. Exposing them in the browser would be a security and cost risk.
- The backend enforces auth, rate limits, validation, and consistent JSON shapes.
- The frontend’s job is **UX**: forms, steppers, loading states, results layout — not AI orchestration.

**Implication for UI:** All “AI work” is triggered by `fetch` to `${VITE_API_URL}/api/...`. Never call `api.minimax.io` from the browser directly.

---

## 2. Why there is no `POST /api/pitch/generate`

The early product doc proposed one endpoint that returns the entire pitch package in a single response. **We did not build that.**

**Rationale:**

| Monolithic `pitch/generate` | Our multi-step pipeline |
|----------------------------|-------------------------|
| One long request (60s–3min+) | Many shorter requests |
| Easy to timeout on Railway/serverless | Each step can fail/retry independently |
| User sees one long spinner | User sees **progress** (better demo + UX) |
| Hard to cache or skip steps | Scan can be cached 24h; steps can be re-run |
| All-or-nothing failure | Partial results saved in Supabase after each step |

**Implication for UI:** Design a **wizard or stepper**, not a single “Generate” blind wait. Judges and users should see: *Capturing → Scanning → Auditing → Interview → Scoring → Building pitch*.

**Do not wait for** a fictional `/api/pitch/generate`. Chain the real endpoints (see UI mapping doc).

---

## 3. Why auth is required (not optional)

The hackathon spec treated auth as optional. **Our production API requires a Bearer token** on every route except health and sign-up/sign-in.

**Rationale:**

- Every session is tied to `user_id` in Supabase — users only see their own data.
- Pitch and campaign jobs are queued per user; prevents abuse of expensive AI calls.
- Aligns with real products (accounts, history, future tiers).

**Implication for UI:**

- Login/sign-up before pitch or campaign flows.
- Store `access_token` (e.g. `localStorage`) and attach `Authorization: Bearer ...` on every API call.
- On `401`, clear token and redirect to login.
- **Include logout** — clears client token; calls `POST /api/auth/signout` for consistency.

---

## 4. Why we use `transcript` instead of `{ idea, country, industry }`

The backend capture step accepts one field: **`transcript`** (string).

**Rationale:**

- Voice-first product: users speak or paste free text; the model extracts structure.
- Fewer validation rules on the server; MiniMax prompt handles parsing.
- Country/industry can still be sent by **concatenating** into the transcript if your form has separate fields.

**Implication for UI:**

- One textarea is enough for MVP.
- Multi-field forms should **merge** into `transcript` before `POST /api/capture` (see UI mapping doc).
- Do not expect the backend to accept `idea` as a top-level key — it will return validation errors.

---

## 5. Why pitch and campaign return `202` + job polling

`POST /api/pitch` and `POST /api/campaign` do **not** return the deck or ZIP immediately. They return `{ jobId, status: "processing" }`.

**Rationale:**

- Pitch generation runs TTS, music, FFmpeg mix, and large LLM calls — often **30s–2min**.
- HTTP connections and Railway request limits favor **async jobs** over holding a connection open.
- Job row in Supabase tracks `progress`, `status`, `result`, `error` for reliable UX.

**Implication for UI:**

1. Call `POST /api/pitch` (or campaign).
2. Show progress UI using `GET /api/jobs/:jobId` every 2–3 seconds.
3. When `status === "completed"`, render `result` or load `GET /api/session/:sessionId`.
4. When `status === "failed"`, show `error` and offer retry from last safe step.

**Anti-pattern:** Blocking the UI for 2 minutes on one `fetch` without polling.

---

## 6. Why sessions are automatic (no `POST /api/sessions`)

The frontend spec included “save session” as a separate call. **We don’t need it.**

**Rationale:**

- `POST /api/capture` creates a session row immediately.
- Each pipeline step **updates** that row (`scan_result`, `audit_result`, etc.).
- `GET /api/session/:id` returns the full accumulated state.
- Avoids duplicate saves and sync bugs between client and server.

**Implication for UI:**

- After capture, keep `sessionId` in React state / URL (`/pitch/:sessionId`).
- Optionally mirror to `localStorage` as backup for refresh — but **server is source of truth**.
- List history with `GET /api/session`, not a custom save button.

---

## 7. Why paths differ slightly from the spec (`/api/session` vs `/api/sessions`)

**Rationale:** Backend was implemented first as a pipeline API with singular resource naming. Changing URLs now would break a live Railway deploy.

**Implication for UI:** Use **`/api/session`** (singular). Treat `/api/sessions` in the old doc as a documentation mistake unless we add an alias later.

Same for health: both `/health` and `/api/health` work; pick one in `apiClient` and stay consistent.

---

## 8. Why errors look like `{ error, message }` not `{ success: false }`

**Rationale:** Matches existing backend middleware and routes. `{ error: "VALIDATION" }` is machine-readable; `message` is human-readable.

**Implication for UI:**

```ts
if (!res.ok) {
  const body = await res.json();
  toast.error(body.message ?? 'Something went wrong');
}
```

Do not require `success: true` on happy paths — many endpoints return the resource directly (`{ sessionId, conceptSummary }`).

---

## 9. Pitch pipeline order is intentional

Steps must run in roughly this order because **later steps depend on earlier data**:

```txt
capture → scan, audit → refine → validate → pitch (job)
```

**Rationale:**

- Scan/audit need `concept_summary` from capture.
- Validate needs `idea_profile` from refine.
- Pitch job needs `viability_score` from validate.

**Implication for UI:**

- Disable “Generate pitch” until validate succeeds.
- If user skips refine, backend returns `INVALID_STATE` — show a clear message (“Complete the interview first”).
- You can **hide** scan/audit in a “quick mode” UI but still call them, or call a minimal refine with placeholder answers — do not call `pitch` first.

---

## 10. Campaign mode is a separate product path

Pitch Mode = idea → investor package.  
Campaign Mode = existing business → marketing assets (ZIP).

**Rationale:** Different prompts, different DB table (`campaigns`), different job processor. Mixing them in one endpoint would blur UX and complicate auth/limits.

**Implication for UI:** Separate route (`/campaign`), separate form (`description`, `tone`), same **job polling pattern** as pitch.

---

## 11. What to show while waiting (UX rationale)

| Phase | User should see | Why |
|-------|-----------------|-----|
| capture | “Understanding your idea…” | LLM structuring concept |
| scan | “Researching market…” | MiniMax web search + LLM merge (slow steps) |
| audit | “Checking risks…” | Search + LLM |
| refine | Question UI | Founder input required — not passive |
| validate | “Scoring viability…” | LLM |
| pitch job | “Building deck & audio…” + % or progress text | Async media pipeline |

**Rationale:** Buildathon demos are judged on **perceived intelligence and polish**. A single spinner hides the work the backend actually does.

---

## 12. Logout and security UX

**Rationale:** JWT is stored client-side. “Logout” means **delete the token** so the next visitor on a shared machine cannot use the account. Server `signout` is idempotent and documents intent.

**Implication for UI:** Always provide logout in nav when logged in. Clear `launchpad_token` and related `sessionId` / `jobId` keys.

---

## 13. Environment and CORS

```env
VITE_API_URL=https://buildathon-production-c28b.up.railway.app
```

**Rationale:**

- Local backend for dev; Railway for demo/production.
- Backend `CORS_ORIGIN` must list your Vercel URL or browser blocks responses.

**Implication for UI:** No hardcoded `localhost:3000` in production builds. One env var for all services.

---

## 14. Mock mode: when and why

```env
VITE_USE_MOCK_API=true
```

**Rationale:** Frontend can build layouts before backend is ready. **Final demo must use real API** so MiniMax and Supabase are actually exercised.

**Implication:** Mock only delays and fake JSON — switch off for integration testing and judging.

---

## 15. How this compares to `launchpad_api_endpoints_deep.md`

| Aspect | Old doc | Our backend |
|--------|---------|-------------|
| Goal | Fastest doc for hackathon sketch | Production-shaped pipeline |
| Pitch | One POST | Many POSTs + GET job |
| Auth | Optional | Required |
| Save | Explicit POST sessions | Automatic |
| Campaign | Sync JSON | Async + ZIP download |

**Use the old doc for:** screen copy, section names, JSON field **ideas** for UI components.  
**Use our docs for:** actual URLs, request bodies, and flow order.

---

## 16. Recommended architecture (frontend)

```txt
Pages (UI)
   ↓
Hooks (usePitchPipeline, useAuth)
   ↓
Services (pitchService.ts — pure fetch)
   ↓
apiClient.ts (base URL, Bearer, errors)
   ↓
Railway backend
```

**Rationale:** Keeps components dumb, makes Cursor refactors safer, allows testing services without React.

---

## 17. Decision summary for product/engineering

1. **Thin client** — no AI keys in browser.  
2. **Multi-step pitch** — better UX, reliability, and demo story than one endpoint.  
3. **Auth everywhere** — sessions and jobs are per user.  
4. **Async jobs** — poll for pitch/campaign media outputs.  
5. **Server-owned session** — no manual save endpoint.  
6. **Transcript-first capture** — matches voice/free-text input.  
7. **Logout + 401 handling** — basic security hygiene.  
8. **Stepper UI** — reflects real backend capabilities.

---

## 18. Cursor instruction block (copy-paste)

```text
Read FRONTEND_API_RATIONALE.md first for why the API is multi-step and async.
Implement using FRONTEND_INTEGRATION.md (contracts) and
FRONTEND_UI_API_MAPPING.md (screens).
Do not implement /api/pitch/generate. Use auth, logout, sessionId, and job polling.
```

---

## Related files

| Document | Role |
|----------|------|
| **FRONTEND_API_RATIONALE.md** (this file) | Why |
| [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) | What to send (HTTP) |
| [FRONTEND_UI_API_MAPPING.md](./FRONTEND_UI_API_MAPPING.md) | Which screen calls what |
| [demo.http](./demo.http) | Working examples |
