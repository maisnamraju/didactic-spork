# JWT Authentication Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from session-based (cookie) authentication to JWT bearer token authentication with access + refresh token pattern.

**Architecture:** Replace session cookie validation with JWT bearer tokens. Access tokens (15 min) stored in memory, refresh tokens (7 days) in httpOnly cookies. Backend validates JWT from Authorization header, frontend manages token lifecycle with automatic refresh on expiry.

**Tech Stack:** better-auth, Express.js, React Query, TypeScript

---

## Task 1: Configure JWT Settings in better-auth

**Files:**
- Modify: `src/lib/better-auth.ts:60`

**Step 1: Update better-auth JWT plugin configuration**

In `src/lib/better-auth.ts`, update the session configuration and plugins array to configure JWT expiry times:

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7, // 7 days for refresh tokens
},
plugins: [
  bearer(),
  jwt({
    jwt: {
      expirationTime: 60 * 15, // 15 minutes for access tokens
    },
  }),
],
```

**Step 2: Verify configuration**

Run: `npm run typecheck`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/better-auth.ts
git commit -m "feat: configure JWT expiry times for access and refresh tokens"
```

---

## Task 2: Update Backend Middleware for JWT

**Files:**
- Modify: `src/middleware/require-auth.ts:8-39`
- Test: `tests/e2e/jwt-auth.e2e.test.ts` (create)

**Step 1: Write failing test for JWT authentication**

Create `tests/e2e/jwt-auth.e2e.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { auth } from "../../src/lib/better-auth";

describe("JWT Authentication E2E", () => {
  let accessToken: string;
  const testUser = {
    email: "jwt-test@example.com",
    password: "SecurePass123!",
    name: "JWT Test User",
  };

  beforeAll(async () => {
    // Sign up and get token
    const signUpRes = await request(app)
      .post("/api/auth/sign-up/email")
      .send(testUser)
      .expect(200);

    accessToken = signUpRes.body.token || signUpRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup test user
  });

  it("should authenticate with valid JWT token", async () => {
    const res = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it("should return 401 with missing Authorization header", async () => {
    await request(app)
      .get("/api/patients")
      .expect(401);
  });

  it("should return 401 with invalid JWT token", async () => {
    await request(app)
      .get("/api/patients")
      .set("Authorization", "Bearer invalid.token.here")
      .expect(401);
  });

  it("should return 401 with malformed Authorization header", async () => {
    await request(app)
      .get("/api/patients")
      .set("Authorization", accessToken) // Missing "Bearer "
      .expect(401);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- tests/e2e/jwt-auth.e2e.test.ts`
Expected: Tests FAIL (middleware still uses session validation)

**Step 3: Update require-auth middleware to use JWT**

In `src/middleware/require-auth.ts`:

```typescript
import { fromNodeHeaders } from "better-auth/node";
import type { Request, RequestHandler } from "express";

import { auth } from "../lib/better-auth";
import type { AuthContext } from "../models/auth-context.model";
import { ApiError } from "../utils/api-error";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "UNAUTHORIZED", "Authorization header required");
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT token
    const verified = await auth.api.verifyJWT({
      token,
    });

    if (!verified || !verified.user) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
    }

    const rawPublicId =
      Reflect.get(verified.user as Record<string, unknown>, "publicId") ??
      Reflect.get(verified.user as Record<string, unknown>, "public_id") ??
      null;

    const publicId = typeof rawPublicId === "number" ? rawPublicId : null;

    const authContext: AuthContext = {
      user: {
        id: verified.user.id,
        email: verified.user.email,
        name: verified.user.name,
        public_id: publicId,
      },
    };

    (req as Request & { auth: AuthContext }).auth = authContext;
    next();
  } catch (error) {
    next(error);
  }
};

export function getAuthContext(req: Request): AuthContext {
  const withAuth = req as Request & Partial<{ auth: AuthContext }>;
  if (!withAuth.auth) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  return withAuth.auth;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- tests/e2e/jwt-auth.e2e.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/middleware/require-auth.ts tests/e2e/jwt-auth.e2e.test.ts
git commit -m "feat: update middleware to validate JWT tokens from Authorization header"
```

---

## Task 3: Create Frontend Token Storage

**Files:**
- Create: `frontend/src/lib/auth/token-store.ts`
- Create: `frontend/src/lib/auth/token-store.test.ts`

**Step 1: Write failing test for token storage**

Create `frontend/src/lib/auth/token-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { tokenStore } from "./token-store";

describe("TokenStore", () => {
  beforeEach(() => {
    tokenStore.clearTokens();
  });

  it("should store and retrieve access token", () => {
    tokenStore.setTokens({
      accessToken: "test-access-token",
      expiresIn: 900,
    });

    expect(tokenStore.getAccessToken()).toBe("test-access-token");
  });

  it("should return null when no token is stored", () => {
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it("should clear tokens", () => {
    tokenStore.setTokens({
      accessToken: "test-token",
      expiresIn: 900,
    });

    tokenStore.clearTokens();

    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it("should detect expired tokens", () => {
    tokenStore.setTokens({
      accessToken: "test-token",
      expiresIn: -1, // Already expired
    });

    expect(tokenStore.isTokenExpired()).toBe(true);
  });

  it("should detect valid tokens", () => {
    tokenStore.setTokens({
      accessToken: "test-token",
      expiresIn: 900, // 15 minutes
    });

    expect(tokenStore.isTokenExpired()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- token-store.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement token storage**

Create `frontend/src/lib/auth/token-store.ts`:

```typescript
interface TokenData {
  accessToken: string;
  expiresAt: number;
}

class TokenStore {
  private tokenData: TokenData | null = null;

  setTokens({ accessToken, expiresIn }: { accessToken: string; expiresIn: number }): void {
    const expiresAt = Date.now() + expiresIn * 1000;
    this.tokenData = { accessToken, expiresAt };
  }

  getAccessToken(): string | null {
    if (!this.tokenData) {
      return null;
    }

    // Return null if token is expired
    if (this.isTokenExpired()) {
      this.clearTokens();
      return null;
    }

    return this.tokenData.accessToken;
  }

  isTokenExpired(): boolean {
    if (!this.tokenData) {
      return true;
    }

    return Date.now() >= this.tokenData.expiresAt;
  }

  clearTokens(): void {
    this.tokenData = null;
  }
}

export const tokenStore = new TokenStore();
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- token-store.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add frontend/src/lib/auth/token-store.ts frontend/src/lib/auth/token-store.test.ts
git commit -m "feat: add in-memory token storage for JWT access tokens"
```

---

## Task 4: Update API Client with Token Interceptors

**Files:**
- Modify: `frontend/src/lib/api/client.ts`

**Step 1: Check current API client implementation**

Run: `cat frontend/src/lib/api/client.ts | head -50`
Expected: See current apiRequest implementation

**Step 2: Update API client to inject Authorization header**

In `frontend/src/lib/api/client.ts`, add token injection and refresh logic:

```typescript
import { tokenStore } from "../auth/token-store";
import { refreshAccessToken } from "./auth";

// Add this type if not already present
export interface ApiClientError {
  status: number;
  code: string;
  message: string;
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "code" in error &&
    "message" in error
  );
}

// Track in-flight refresh to avoid concurrent refreshes
let refreshPromise: Promise<void> | null = null;

async function handleTokenRefresh(): Promise<void> {
  // If already refreshing, wait for that to complete
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      await refreshAccessToken();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${import.meta.env.VITE_API_URL || "http://localhost:3001"}${endpoint}`;

  // Inject Authorization header if token exists
  const token = tokenStore.getAccessToken();
  const headers = new Headers(options.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Include cookies for refresh token
    });

    // Handle 401 - token expired, try refresh
    if (response.status === 401) {
      try {
        await handleTokenRefresh();

        // Retry original request with new token
        const newToken = tokenStore.getAccessToken();
        if (newToken) {
          headers.set("Authorization", `Bearer ${newToken}`);
          const retryResponse = await fetch(url, {
            ...options,
            headers,
            credentials: "include",
          });

          if (!retryResponse.ok) {
            throw await parseErrorResponse(retryResponse);
          }

          return await retryResponse.json();
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        tokenStore.clearTokens();
        window.location.href = "/sign-in";
        throw refreshError;
      }
    }

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    if (isApiClientError(error)) {
      throw error;
    }

    throw {
      status: 500,
      code: "NETWORK_ERROR",
      message: "Network request failed",
    };
  }
}

async function parseErrorResponse(response: Response): Promise<ApiClientError> {
  try {
    const error = await response.json();
    return {
      status: response.status,
      code: error.code || "UNKNOWN_ERROR",
      message: error.message || "An error occurred",
    };
  } catch {
    return {
      status: response.status,
      code: "PARSE_ERROR",
      message: response.statusText || "An error occurred",
    };
  }
}
```

**Step 3: Verify TypeScript compilation**

Run: `cd frontend && npm run typecheck`
Expected: No type errors (will fail if refreshAccessToken doesn't exist yet - that's okay, we'll add it next)

**Step 4: Commit**

```bash
git add frontend/src/lib/api/client.ts
git commit -m "feat: add JWT token injection and automatic refresh to API client"
```

---

## Task 5: Update Auth API Functions

**Files:**
- Modify: `frontend/src/lib/api/auth.ts`

**Step 1: Update auth functions to handle JWT tokens**

In `frontend/src/lib/api/auth.ts`, update to extract and store tokens:

```typescript
import { apiRequest, isApiClientError } from "@/lib/api/client";
import { tokenStore } from "../auth/token-store";

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  name: string;
}

interface SessionDto {
  user?: {
    id: string;
    email: string;
    name: string;
    publicId?: number | null;
    public_id?: number | null;
  } | null;
  session?: {
    expiresAt?: string | null;
  } | null;
}

interface AuthResponse {
  token?: string;
  accessToken?: string;
  expiresIn?: number;
  user?: SessionDto["user"];
  session?: SessionDto["session"];
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    publicId: number | null;
  };
  expiresAt: string | null;
}

function mapSession(session: SessionDto | null): AuthSession | null {
  if (!session?.user) {
    return null;
  }

  const rawPublicId = session.user.publicId ?? session.user.public_id ?? null;
  const publicId = typeof rawPublicId === "number" ? rawPublicId : null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      publicId,
    },
    expiresAt: session.session?.expiresAt ?? null,
  };
}

export async function signIn(input: SignInInput): Promise<void> {
  const response = await apiRequest<AuthResponse>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify(input),
  });

  // Extract and store access token
  const accessToken = response.token || response.accessToken;
  const expiresIn = response.expiresIn || 900; // Default 15 minutes

  if (accessToken) {
    tokenStore.setTokens({ accessToken, expiresIn });
  }
}

export async function signUp(input: SignUpInput): Promise<void> {
  const response = await apiRequest<AuthResponse>("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify(input),
  });

  // Extract and store access token
  const accessToken = response.token || response.accessToken;
  const expiresIn = response.expiresIn || 900; // Default 15 minutes

  if (accessToken) {
    tokenStore.setTokens({ accessToken, expiresIn });
  }
}

export async function signOut(): Promise<void> {
  try {
    await apiRequest<unknown>("/api/auth/sign-out", {
      method: "POST",
    });
  } finally {
    // Always clear tokens, even if API call fails
    tokenStore.clearTokens();
  }
}

export async function refreshAccessToken(): Promise<void> {
  const response = await apiRequest<AuthResponse>("/api/auth/refresh", {
    method: "POST",
  });

  const accessToken = response.token || response.accessToken;
  const expiresIn = response.expiresIn || 900;

  if (!accessToken) {
    throw new Error("No access token in refresh response");
  }

  tokenStore.setTokens({ accessToken, expiresIn });
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    // Check if we have a valid token first
    const token = tokenStore.getAccessToken();
    if (!token) {
      return null;
    }

    console.log("[Auth] Fetching session from API");
    const response = await apiRequest<SessionDto>("/api/auth/get-session");
    console.log("[Auth] Raw session response:", response);
    const mapped = mapSession(response);
    console.log("[Auth] Mapped session:", mapped);
    return mapped;
  } catch (error) {
    console.error("[Auth] Error fetching session:", error);
    if (isApiClientError(error) && error.status === 401) {
      console.log("[Auth] 401 error, clearing tokens and returning null");
      tokenStore.clearTokens();
      return null;
    }

    throw error;
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

**Step 3: Commit**

```bash
git add frontend/src/lib/api/auth.ts
git commit -m "feat: update auth functions to extract and store JWT tokens"
```

---

## Task 6: Update Existing E2E Tests

**Files:**
- Modify: `tests/e2e/auth.e2e.test.ts`

**Step 1: Check current auth e2e test**

Run: `cat tests/e2e/auth.e2e.test.ts | head -100`
Expected: See current test implementation

**Step 2: Update auth e2e tests to use JWT tokens**

In `tests/e2e/auth.e2e.test.ts`, update tests to expect and use JWT tokens:

```typescript
// Update the sign-in test to verify token response
it("should sign in with valid credentials", async () => {
  const res = await request(app)
    .post("/api/auth/sign-in/email")
    .send({
      email: testUser.email,
      password: testUser.password,
    })
    .expect(200);

  // Verify JWT token is returned
  expect(res.body.token || res.body.accessToken).toBeDefined();
  expect(res.body.expiresIn).toBeDefined();

  accessToken = res.body.token || res.body.accessToken;
});

// Update authenticated request tests to use Authorization header
it("should access protected route with valid token", async () => {
  const res = await request(app)
    .get("/api/patients")
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(200);

  expect(res.body).toBeDefined();
});
```

**Step 3: Run tests to verify they pass**

Run: `npm run test:e2e -- tests/e2e/auth.e2e.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add tests/e2e/auth.e2e.test.ts
git commit -m "test: update auth e2e tests to use JWT tokens"
```

---

## Task 7: Run Full Test Suite

**Files:**
- N/A (verification task)

**Step 1: Run all backend tests**

Run: `npm run test`
Expected: All tests PASS

**Step 2: Run all e2e tests**

Run: `npm run test:e2e`
Expected: All tests PASS

**Step 3: Run frontend tests**

Run: `cd frontend && npm test`
Expected: All tests PASS

**Step 4: Run type checking**

```bash
npm run typecheck
cd frontend && npm run typecheck
```
Expected: No type errors

**Step 5: Commit if any fixes were needed**

If you had to make fixes:
```bash
git add .
git commit -m "fix: address test failures and type errors"
```

---

## Task 8: Update Documentation

**Files:**
- Create: `docs/JWT_AUTHENTICATION.md`

**Step 1: Create JWT authentication documentation**

Create `docs/JWT_AUTHENTICATION.md`:

```markdown
# JWT Authentication

## Overview

This application uses JWT (JSON Web Tokens) bearer token authentication with access and refresh tokens.

## Architecture

- **Access Tokens**: Short-lived (15 minutes), stored in memory on the frontend
- **Refresh Tokens**: Long-lived (7 days), stored in httpOnly cookies
- **Token Transmission**: Access tokens sent in `Authorization: Bearer <token>` header

## Frontend Usage

### Sign In

```typescript
import { signIn } from "@/lib/api/auth";

await signIn({
  email: "user@example.com",
  password: "password",
});
// Tokens are automatically stored
```

### Making Authenticated Requests

```typescript
import { apiRequest } from "@/lib/api/client";

// Authorization header is automatically added
const data = await apiRequest("/api/protected-endpoint");
```

### Token Refresh

Token refresh happens automatically when:
- An API request returns 401 Unauthorized
- The access token has expired

The API client will:
1. Attempt to refresh the access token using the refresh token
2. Retry the failed request with the new token
3. If refresh fails, redirect to login

### Sign Out

```typescript
import { signOut } from "@/lib/api/auth";

await signOut();
// Tokens are automatically cleared
```

## Backend Usage

### Protected Routes

```typescript
import { requireAuth } from "./middleware/require-auth";

app.get("/api/protected", requireAuth, (req, res) => {
  // Access user info from req.auth
  const userId = req.auth.user.id;
  res.json({ message: "Protected data" });
});
```

### Manual Token Verification

```typescript
import { auth } from "./lib/better-auth";

const verified = await auth.api.verifyJWT({ token });
if (verified?.user) {
  // Token is valid
}
```

## Security Considerations

1. **XSS Protection**: Access tokens stored in memory (not localStorage)
2. **CSRF Protection**: Refresh tokens in httpOnly cookies
3. **Short-lived Access Tokens**: 15-minute expiry limits exposure
4. **HTTPS Only**: All tokens transmitted over secure connections
5. **Server Validation**: Every request validates JWT signature

## Token Expiry Handling

- Access token expires: Automatic refresh, transparent to user
- Refresh token expires: User must re-authenticate
- Both expired: Redirect to login with "Session expired" message

## Migration from Sessions

This app migrated from session-based (cookie) authentication to JWT. Key differences:

- **Before**: Sessions stored in database, validated via cookies
- **After**: Stateless JWT validation, no session database lookups
- **Performance**: Reduced database load on authenticated requests
- **Scalability**: Better horizontal scaling (no session state)
```

**Step 2: Commit documentation**

```bash
git add docs/JWT_AUTHENTICATION.md
git commit -m "docs: add JWT authentication documentation"
```

---

## Task 9: Final Verification

**Files:**
- N/A (verification task)

**Step 1: Test complete authentication flow manually**

Start the backend:
```bash
npm run dev
```

Start the frontend:
```bash
cd frontend && npm run dev
```

**Step 2: Manual testing checklist**

- [ ] Sign up with new user
- [ ] Verify access token is stored (check Network tab)
- [ ] Navigate to protected page
- [ ] Verify Authorization header is sent (check Network tab)
- [ ] Wait for token to expire (or modify expiry to 10 seconds for testing)
- [ ] Make API request, verify auto-refresh happens
- [ ] Sign out, verify tokens are cleared
- [ ] Try accessing protected route, verify redirect to login

**Step 3: Review git history**

Run: `git log --oneline -10`
Expected: See all commits from this implementation

**Step 4: Final commit if needed**

If any final tweaks were made:
```bash
git add .
git commit -m "chore: final verification and cleanup"
```

---

## Success Criteria

✅ All tests pass (backend, frontend, e2e)
✅ Token injection works automatically
✅ Token refresh happens transparently on expiry
✅ Sign out clears all tokens
✅ Protected routes require valid JWT
✅ 401 errors handled gracefully
✅ No session database queries on authenticated requests
✅ Documentation is complete

## Rollback Plan

If issues occur in production:

1. Revert commits from this migration
2. Redeploy previous session-based version
3. No data migration needed (users just need to re-login)

## Notes

- Token expiry times can be adjusted in `src/lib/better-auth.ts`
- Frontend token storage is intentionally in-memory for security
- Refresh token cookies are httpOnly and secure in production
