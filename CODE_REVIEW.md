# Backend Code Review — Reliability Focus

**Reviewer:** Senior Software Engineer
**Date:** 2026-02-17
**Scope:** Full backend codebase review with reliability focus

---

## Overall Assessment

Well-structured, cleanly layered codebase. Good separation of concerns, Zod validation at boundaries, proper async error handling, and consistent patterns throughout. The issues below are the kind of things that don't matter during development but surface hard in production under load or during failures.

---

## Findings

### 1. CRITICAL: Race condition in `ChatService.createReply`

**File:** `src/services/chat.service.ts:52-94`

The user message is persisted **before** the AI call, but if the AI call fails (502), you have an orphaned user message in the database with no corresponding assistant reply. Subsequent retries from the client will create **duplicate** user messages.

**Impact:** Data corruption. Chat history becomes inconsistent — user messages without AI responses pile up on retries.

**Fix:** Wrap the user message insert + AI call + assistant message insert in a transaction. If the AI call fails, roll back the user message too. Alternatively, if you want to keep the user message on failure, store a status field on ChatMessage so the client knows which messages are "pending."

```typescript
// Current (problematic):
await prisma.chatMessage.create({ data: { role: "user", ... } });
const aiResponse = await this.aiProvider.generateResponse(...); // fails here = orphan
await prisma.chatMessage.create({ data: { role: "assistant", ... } });

// Recommended:
const result = await prisma.$transaction(async (tx) => {
  const userMsg = await tx.chatMessage.create({ data: { role: "user", ... } });
  let aiResponse;
  try {
    aiResponse = await this.aiProvider.generateResponse(...);
  } catch (error) {
    // Transaction rolls back the user message
    throw error;
  }
  const assistantMsg = await tx.chatMessage.create({ data: { role: "assistant", ... } });
  return assistantMsg;
});
```

---

### 2. CRITICAL: TOCTOU race in `PatientService.update` and `softDelete`

**File:** `src/services/patient.service.ts:102-132`

Both `update()` and `softDelete()` first call `getById()` to verify ownership, then perform a separate `update()` query using **only the record `id`** — without the `ownerUserId` in the `where` clause. Between the check and the write, the ownership constraint is not enforced atomically.

```typescript
// Line 103: checks ownership
await this.getById(ownerUserId, id);
// Line 105-116: updates by id alone — no ownerUserId in where
await prisma.patient.update({ where: { id } ... });
```

**Impact:** In a concurrent environment this is a theoretical authorization bypass. More practically, it means a soft-deleted patient (deleted between the check and the write) could be re-updated.

**Fix:** Include `ownerUserId` and `deletedAt: null` in the `where` clause of the update query itself, or use a Prisma transaction with a `findFirst`+`update` in sequence.

```typescript
// Recommended: enforce ownership in the write itself
const updated = await prisma.patient.updateMany({
  where: { id, ownerUserId, deletedAt: null },
  data: { ... },
});
if (updated.count === 0) {
  throw new ApiError(404, "NOT_FOUND", "Patient not found");
}
```

---

### 3. HIGH: Graceful shutdown doesn't have a timeout

**File:** `src/server.ts:11-17`

```typescript
server.close(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

If there are long-running requests (e.g., a slow AI provider call), `server.close()` will wait indefinitely. In container environments (Kubernetes, Docker), this means the process hangs until the orchestrator force-kills it (typically 30s SIGKILL), which can leave database connections in a dirty state.

**Fix:** Add a hard timeout:

```typescript
async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`);

  const forceExit = setTimeout(() => {
    console.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);

  server.close(async () => {
    await prisma.$disconnect();
    clearTimeout(forceExit);
    process.exit(0);
  });
}
```

---

### 4. HIGH: No `unhandledRejection` / `uncaughtException` handlers

**File:** `src/server.ts`

If an unhandled promise rejection or uncaught exception occurs outside of the Express request lifecycle (e.g., in a background timer, event listener, or the Prisma connection pool), the process will crash silently or with a default Node.js warning — with no cleanup.

**Fix:**

```typescript
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  void shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  void shutdown("uncaughtException");
});
```

---

### 5. HIGH: Health check doesn't verify database connectivity

**File:** `src/routes/index.ts:8-10`

```typescript
apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
```

This always returns 200 even if the database is completely down. Load balancers and orchestrators will keep routing traffic to an instance that can't serve any data requests.

**Fix:**

```typescript
apiRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", reason: "database unreachable" });
  }
});
```

Consider a `/health/live` (process is alive) vs `/health/ready` (can serve traffic) split.

---

### 6. MEDIUM: No request timeout

**File:** `src/app.ts`

There is no server-level or middleware-level request timeout. If the AI provider hangs indefinitely, the request will hold a connection open forever, exhausting the connection pool and eventually the server's ability to accept new connections.

**Fix:** Set `server.setTimeout()` or add an Express timeout middleware. Also consider a timeout on the AI provider call itself:

```typescript
// In server.ts
server.setTimeout(30_000);

// Or per-route for AI-dependent endpoints
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}
```

---

### 7. MEDIUM: No rate limiting on sensitive endpoints

The `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, and `/emails/send` endpoints have no rate limiting. This is a reliability concern (not just security) — a burst of sign-up or email-send requests can overwhelm the bcrypt CPU cost, the database, and the SMTP server.

**Fix:** Add `express-rate-limit` or equivalent, at minimum on auth and email routes:

```typescript
import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many attempts" } },
});

app.use("/api/auth", authLimiter);
```

---

### 8. MEDIUM: Prisma client has no connection pool tuning

**File:** `src/lib/prisma.ts`

Creates the PrismaClient with the `@prisma/adapter-pg` adapter but provides no connection pool configuration. The default `pg` pool size (10) may be too small under load, and there are no idle timeout, connection timeout, or max lifetime settings.

**Fix:**

```typescript
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  pool: {
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  },
});
```

---

### 9. MEDIUM: `BETTER_AUTH_SECRET` default value is insecure

**File:** `src/config/env.ts:18`

```typescript
.default("replace-this-in-prod-with-32-plus-char-secret")
```

Having a default secret means the app will **silently start in production** with a known, hard-coded secret if the env var is missing. This passes the Zod validation because it's 32+ chars.

**Fix:** Remove the `.default()`. In production, a missing secret should be a fatal startup error. If you want a default for local dev, gate it on NODE_ENV.

---

### 10. MEDIUM: `DATABASE_URL` has a default connection string

**File:** `src/config/env.ts:13`

```typescript
DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/teraleads"),
```

Same class of problem as #9. The app will silently connect to `localhost:5432/teraleads` with `postgres:postgres` credentials if `DATABASE_URL` is missing. In a misconfigured production deploy, this could either fail silently or connect to the wrong database.

**Fix:** Remove the default, or only allow it in non-production environments.

---

### 11. LOW: Error handler leaks Prisma internals

**File:** `src/middleware/error-handler.ts:42-51`

```typescript
details: maybePrismaError.meta,
```

The Prisma error `meta` field can contain table names, column names, and constraint names. This is useful for debugging but should not be returned to API consumers in production.

**Fix:** Log the full error server-side, but only return a sanitized message to the client in production:

```typescript
if (maybePrismaError.code === "P2002") {
  console.error("Prisma unique constraint violation:", maybePrismaError.meta);
  res.status(409).json({
    error: {
      code: "CONFLICT",
      message: "A record with this value already exists",
      ...(env.NODE_ENV !== "production" ? { details: maybePrismaError.meta } : {}),
    },
  });
  return;
}
```

---

### 12. LOW: Module-level singleton instantiation in controllers

**Files:** `src/controllers/chat.controller.ts:13`, `src/controllers/patient.controller.ts:12`

```typescript
const chatService = new ChatService(new MockAIProvider());
const patientService = new PatientService();
```

Services are instantiated at module import time. This means:
- The AI provider is hard-coded to `MockAIProvider` regardless of `env.AI_PROVIDER`
- Swapping implementations for integration testing requires module mocking
- Adding a real AI provider requires editing the controller file

**Fix:** Use a factory or lightweight DI that reads from `env.AI_PROVIDER`:

```typescript
// src/services/ai/index.ts
function createAIProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case "mock": return new MockAIProvider();
    default: throw new Error(`Unknown AI provider: ${env.AI_PROVIDER}`);
  }
}
```

---

### 13. LOW: Soft-delete uniqueness gaps in schema

**File:** `prisma/schema.prisma`

The Patient model has no unique constraint on `(ownerUserId, email)` or `(ownerUserId, phone)` in the Prisma schema — meaning a user could create two patients with the same email. If you have partial unique indexes in the migration SQL (filtering on `deleted_at IS NULL`), they won't be reflected in Prisma's schema and the resulting P2002 errors will surface as untyped conflicts.

**Fix:** Document the partial unique indexes clearly, or add application-level uniqueness checks in `PatientService.create` that provide clear error messages.

---

## Summary — Priority Actions

| # | Priority | Issue | Effort |
|---|----------|-------|--------|
| 1 | Critical | Chat message orphan on AI failure | Medium |
| 2 | Critical | TOCTOU in patient update/delete | Low |
| 3 | High | Shutdown timeout missing | Low |
| 4 | High | No unhandled rejection handlers | Low |
| 5 | High | Health check doesn't probe DB | Low |
| 6 | Medium | No request/AI call timeout | Low |
| 7 | Medium | No rate limiting | Medium |
| 8 | Medium | No connection pool config | Low |
| 9 | Medium | Default secrets in production | Low |
| 10 | Medium | Default DATABASE_URL | Low |
| 11 | Low | Prisma meta leak in errors | Low |
| 12 | Low | Hard-coded service singletons | Medium |
| 13 | Low | Soft-delete uniqueness | Low |

**Recommendation:** Items 1-5 should be addressed before any production deployment. Items 6-10 should be addressed before handling real user traffic. Items 11-13 are improvements to make when convenient.
