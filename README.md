# TeraLeads Backend

Express + Better Auth + Prisma + PostgreSQL backend with:
- Better Auth native endpoints (`/api/auth/*`) using `bearer` + `jwt` plugins
- Owner-scoped patient CRUD and chat APIs
- Configurable AI providers (`mock` or external microservice)
- Cursor pagination
- Soft-delete patients
- E2E tests with Vitest + Supertest

## Prerequisites

- Node.js 20+
- PostgreSQL
- Python 3.11+ (only if running the optional AI microservice)

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Update `DATABASE_URL`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, and SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`).

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Apply migrations:

```bash
npm run prisma:migrate
```

5. Start dev server:

```bash
npm run dev
```

## Frontend Dashboard

The React frontend lives in `frontend/` and uses:
- Vite + React + TypeScript
- TanStack Router + TanStack Query
- shadcn/ui
- `@assistant-ui/react` modal primitives for patient chat

Run it locally (in a separate terminal while backend is running):

```bash
cd frontend
npm install
npm run dev
```

By default, the frontend dev server proxies `/api`, `/patients`, and `/chat` to `http://localhost:3000`.

Auth is cookie/session-based and all frontend API requests use `credentials: include`.

## AI Microservice (Optional)

The chat API can call a FastAPI AI sidecar via:
- `AI_PROVIDER=microservice`
- `AI_SERVICE_URL=http://localhost:8000`

The sidecar lives in `ai-service/` and exposes:
- `POST /generate`
- `GET /health`

Start it with:

```bash
pip install -r ai-service/requirements.txt
cp ai-service/.env.example ai-service/.env
uvicorn main:app --app-dir ai-service/app --host 0.0.0.0 --port 8000 --env-file ai-service/.env --reload
```

To use OpenRouter in the sidecar, set:
- `AI_MODE=openrouter`
- `OPENROUTER_API_KEY=<your key>`
- `OPENROUTER_MODEL=<model id>`

## Test

```bash
npm run test:e2e
```

Set `TEST_DATABASE_URL` to a dedicated test database and `RUN_E2E=true` before running e2e tests.

## API Endpoints

### Auth (Better Auth native)
- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`
- `GET /api/auth/token`
- `GET /api/auth/jwks`

### Patients
- `POST /patients`
- `GET /patients?limit=<1..100>&cursor=<int>`
- `GET /patients/:id`
- `PATCH /patients/:id`
- `DELETE /patients/:id`

### Chat
- `POST /chat`
- `GET /patients/:id/chats?limit=<1..100>&cursor=<int>`

### Email
- `POST /emails/send`
