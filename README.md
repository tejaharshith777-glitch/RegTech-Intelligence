# RegTech Intelligence

**The AI proposes, a human decides, and the system proves both.**

RegTech Intelligence turns regulatory circulars (PDF) into verifiable, triaged obligations, then
routes each one through a server-enforced maker-checker approval and seals the decision into a
hash-chained audit ledger. Every quoted clause is checked against the real PDF text before it is
allowed to appear as evidence, and the model's output is scanned by a deterministic PII guard
*after* the model runs. The result is a compliance trail an auditor can walk backwards: obligation →
clause → page → actor → timestamp → reason → hash.

Built for the **AI Security, Privacy & Trust** track.

> **What this is not.** It is a demonstration product built on a *synthetic test corpus modelled on
> FINRA / SEC / GDPR / HIPAA / Basel III / FinCEN formats*. It is not legal advice, and it does not
> claim to be novel — commercial RegTech vendors cover similar ground. It competes on **rigour**:
> every control is enforced by the server and has a test that proves it.

---

## Live deployment

| Layer | URL |
| --- | --- |
| Frontend | https://reg-tech-intelligence.vercel.app |
| API | https://regtech-intelligence.onrender.com |
| Health check | https://regtech-intelligence.onrender.com/api/health |

> The Render free tier sleeps after inactivity. The first request after a quiet period can take
> ~30 seconds to wake; the UI shows a loading state rather than failing.

---

## Architecture

```
                     ┌──────────────────────────────────────────────┐
                     │  Browser (React 18 + Vite + Tailwind)        │
                     │  Landing page · Console · Review drawer      │
                     └───────────────────────┬──────────────────────┘
                                             │ same-origin /api/*
                                             │ (Vercel rewrite, no CORS surface)
                     ┌───────────────────────▼──────────────────────┐
                     │  Vercel — static frontend                     │
                     │  frontend/vercel.json                         │
                     │   /api/(.*) → Render API                      │
                     └───────────────────────┬──────────────────────┘
                                             │ HTTPS
                     ┌───────────────────────▼──────────────────────┐
                     │  Express API (Node 20) — Render               │
                     │                                               │
                     │  helmet · cors allowlist · trust proxy        │
                     │  rate limits (global + /api/auth)             │
                     │  JWT auth (protect) · requireAdmin            │
                     │                                               │
                     │  ┌─────────────────────────────────────────┐  │
                     │  │ Ingestion pipeline (in memory)          │  │
                     │  │  PDF buffer → Gemini 2.5 Flash          │  │
                     │  │          → deterministic PII scan       │  │
                     │  │          → clause verification vs PDF   │  │
                     │  │          → applicability triage         │  │
                     │  └─────────────────────────────────────────┘  │
                     └───────────┬───────────────────────┬──────────┘
                                 │                       │
                 ┌───────────────▼──────────┐   ┌────────▼─────────────────┐
                 │  MongoDB Atlas            │   │  Google Gemini API       │
                 │  users · documents ·      │   │  gemini-2.5-flash        │
                 │  insights + hash chain    │   │  (server-side key only)  │
                 └───────────────────────────┘   └──────────────────────────┘
```

---

## Tech stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Frontend | React 18, Vite 5, Tailwind CSS 3 | SPA, no router dependency |
| Data fetching | TanStack Query 5, axios | relative `/api` base URL |
| Backend | Node.js 20, Express 4 | CommonJS |
| Database | MongoDB Atlas + Mongoose 8 | no ORM migration required |
| AI | `@google/generative-ai` → Gemini 2.5 Flash | key lives in backend env only |
| Auth | JWT (`jsonwebtoken`) + bcryptjs | server-assigned roles |
| Validation | Zod 4 | request bodies only |
| Uploads | Multer `memoryStorage` | 15 MB cap, zero disk retention |
| PDF text | custom, dependency-free | `utils/pdfText.js` (zlib + content streams) |
| Ledger | Node `crypto` SHA-256 | chained per decision |

---

## Prerequisites

- **Node.js 20** (18+ works; 20 is what was tested)
- A **MongoDB Atlas** cluster (free tier is enough)
- A **Google Gemini API key** from https://aistudio.google.com/apikey

---

## Local setup

```bash
# 1. Backend
npm install
cp .env.example .env          # then fill in MONGODB_URI, JWT_SECRET, GEMINI_API_KEY
npm run dev                   # http://localhost:5000

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:5000` in development, so the browser only ever talks to
its own origin. If you prefer to serve the built SPA from Express instead:

```bash
cd frontend && npm run build && cd ..
npm start                     # http://localhost:5000 serves the built UI
```

---

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `PORT` | no | API port. Default `5000`. |
| `NODE_ENV` | yes | `development` \| `production` \| `test`. |
| `MONGODB_URI` | **yes** | MongoDB Atlas connection string. **The name is `MONGODB_URI`, not `MONGO_URI`.** |
| `JWT_SECRET` | **yes** | Signing secret. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `JWT_EXPIRES_IN` | no | Token lifetime. Default `7d`. |
| `GEMINI_API_KEY` | **yes** | Google Gemini key. **Backend only** — never in the frontend bundle. |
| `GEMINI_MODEL` | no | Preferred model. Default `gemini-2.5-flash`. |
| `CLIENT_ORIGIN` | no | Comma-separated extra CORS origins. The Vercel frontend does not need this because it calls the API through a same-origin rewrite. |
| `ADMIN_EMAILS` | no | Comma-separated emails that are created as **administrators** on registration. This is the only self-serve admin bootstrap. |
| `DISABLE_MEMORY_FALLBACK` | no | `true` makes the server exit if MongoDB is unreachable. Recommended in production. |
| `RATE_LIMIT_WINDOW_MS` | no | Global rate-limit window. Default `900000` (15 min). |
| `RATE_LIMIT_MAX_REQUESTS` | no | Global request cap per window. Default `300`. |

Frontend needs no environment variables: it calls the relative path `/api` and relies on the Vite
dev proxy locally and the Vercel rewrite in production.

---

## API endpoints

| Method | Path | Role required | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | Liveness **and real DB state** (503 + `db:"disconnected"` when Mongo is down) |
| `POST` | `/api/auth/register` | public | Create an account. Any `role` in the body is ignored — you get `researcher` unless your email is in `ADMIN_EMAILS`. |
| `POST` | `/api/auth/login` | public | Exchange credentials for a JWT. Identical error message for unknown email and wrong password. |
| `GET` | `/api/auth/me` | any signed-in | Current profile, role and applicability scope |
| `PATCH` | `/api/auth/me/applicability` | any signed-in | Save jurisdiction / entity types / business lines |
| `PATCH` | `/api/auth/users/:id/role` | **admin** | Promote or demote. Refuses self-demotion and refuses to remove the last admin. |
| `POST` | `/api/research/upload` | any signed-in | Ingest a PDF (`multipart/form-data`, field name `document`) |
| `GET` | `/api/research/insights` | any signed-in | List findings + triage counts |
| `GET` | `/api/research/insights/:id` | any signed-in | One finding |
| `POST` | `/api/research/insights/:id/clarify` | any signed-in | Ask a question. Status stays `Pending`. |
| `PUT` | `/api/research/insights/:id/approve` | **admin** | Approve or reject. Rejection requires a reason of 10+ characters. |
| `GET` | `/api/research/insights/:id/audit-pack` | any signed-in | Markdown evidence bundle + SHA-256 of the pack |
| `GET` | `/api/research/insights/:id/obligations.csv` | any signed-in | Obligations as CSV |
| `GET` | `/api/research/audit/verify` | any signed-in | Recompute and validate the hash chain |
| `POST` | `/api/research/compare` | any signed-in | Diff two circulars |

---

## Governance model

- **Researchers** ingest circulars, read extracted obligations, and request clarification.
- **Only administrators** can approve or reject a finding. This is enforced twice: by
  `requireAdmin` at the route layer *and* by a role check inside the controller, so neither layer
  is load-bearing on its own.
- **A decision is terminal.** An already-decided finding returns `409` and cannot be re-decided;
  the ledger is append-only.
- **Roles are never client-controlled.** `POST /api/auth/register` ignores any `role` field.
  The only bootstrap is the server-side `ADMIN_EMAILS` list; after that, an existing administrator
  promotes people via `PATCH /api/auth/users/:id/role`.
- **Clarification is not a decision.** It keeps the finding `Pending` and never writes to the
  hash chain.

---

## Security notes

| Control | How it works |
| --- | --- |
| Password storage | bcrypt, 12 salt rounds, `select: false` so hashes never leave the database by default |
| No user enumeration | Login returns the identical `401 "Invalid email or password."` for an unknown email and a wrong password |
| Server-assigned roles | Registration discards client-supplied `role`; `ADMIN_EMAILS` is env-only |
| Maker-checker approval | Route-level `requireAdmin` + controller-level role check + named actor stored on the record |
| Hash-chained ledger | Each decision hashes `prevHash | insightId | status | actor | timestamp | reason` with SHA-256 |
| Deterministic PII scan | A regex guard over 8 identifier patterns runs on the model's output *after* it runs; the model's promise is never the last word |
| Clause verification | `utils/pdfText.js` extracts the real PDF text (built-in `zlib`, no dependency); a clause that is not found is nulled out, not shown as a citation |
| Zero disk retention | Multer `memoryStorage`; the PDF exists only as a buffer for the life of the request |
| Rate limiting | Global limiter plus a stricter limiter on `/api/auth` |
| Proxy awareness | `app.set('trust proxy', 1)` so rate limits key on the real client IP behind Render |
| Production DB guard | In production the server exits rather than silently falling back to an in-memory store |

---

## Testing

The suite drives the real Express app against a real MongoDB and a **stubbed** Gemini client, so it
tests *our* logic, not Google's model.

```bash
# Option A — throwaway in-memory MongoDB
npm i -D mongodb-memory-server
npm test

# Option B — point at any throwaway database
MONGODB_URI="mongodb://localhost:27017/regtech_test" JWT_SECRET=test npm test
```

Covered: role escalation, duplicate email, identical auth errors, admin promotion rules,
maker-checker (403 for researchers), mandatory rejection reasons, decision immutability (409),
clause verification (a fabricated quote loses its citation), triage arithmetic, audit-pack contents,
CSV shape, hash-chain integrity, and honest health reporting.

---

## Deployment

### Render (backend)

| Setting | Value |
| --- | --- |
| Root directory | *(leave empty — repo root)* |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Environment: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `NODE_ENV=production`,
`ADMIN_EMAILS=<your admin email>`, `DISABLE_MEMORY_FALLBACK=true`.

### Vercel (frontend)

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

`frontend/vercel.json` rewrites `/api/*` to the Render API and everything else to `index.html`.
No environment variables are needed on Vercel.

---

## Demo accounts

These are created through the normal registration flow — they are not hardcoded bypasses.
For the administrator, the deployment must list the email in `ADMIN_EMAILS` **before** first
registration:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `chief@example.com` | `Passw0rdTest` |
| Researcher | `researcher@example.com` | `Passw0rdTest` |

The **Demo accounts** buttons on the sign-in screen only *fill the form*; you still authenticate
with a real password checked by the server. If those accounts do not exist yet, register them once
through the Register tab.

---

## Project layout

```
config/            db connection (with production guard) · gemini client
controllers/       auth · research (ingestion, approval, exports)
middleware/        protect · requireAdmin · upload · error handling
models/            User · Document · Insight (obligations + ledger fields)
routes/            /api/auth · /api/research
utils/             piiGuard (deterministic scan) · pdfText (clause verification)
validators/        Zod schemas
tests/             node:test behavioural suite
frontend/          React SPA (src/pages, src/components, src/services)
sample-compliance-docs/  six synthetic circulars used in tests and demos
```

---

## Licence

MIT.
