# TeraLeads Backend

Express + Better Auth + Prisma + PostgreSQL backend with:
- Better Auth native endpoints (`/api/auth/*`) using `bearer` + `jwt` plugins
- Owner-scoped patient CRUD and chat APIs
- Cursor pagination
- Soft-delete patients
- E2E tests with Vitest + Supertest

## Prerequisites

- Node.js 20+
- PostgreSQL

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
