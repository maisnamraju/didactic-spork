# JWT Authentication Migration Design

**Date:** 2026-02-19
**Status:** Approved
**Type:** Authentication System Migration

## Overview

Migrate from session-based (cookie) authentication to JWT bearer token authentication using access + refresh token pattern.

## Current State

- Using better-auth library with session-based authentication
- Sessions stored in database, validated via cookies
- Backend middleware uses `auth.api.getSession()` to validate requests
- Frontend relies on automatic cookie handling
- JWT and bearer plugins are loaded but not actively used

## Target State

- JWT bearer token authentication with access + refresh tokens
- Access tokens: short-lived (15 minutes), stored in memory
- Refresh tokens: long-lived (7 days), stored in httpOnly cookies
- Backend validates JWT from Authorization header
- Frontend manually manages token lifecycle and injection
- Stateless authentication (no session database lookups)

## Approach: Access + Refresh Token Pattern

### Why This Approach?

- **Security**: Short-lived access tokens limit blast radius if stolen
- **UX**: Refresh tokens enable persistent sessions across page refreshes
- **Industry Standard**: Follows OAuth 2.0 best practices
- **Better-auth Support**: Built-in refresh token infrastructure

### Trade-offs

**Pros:**
- Most secure JWT implementation
- Better-auth has native support
- Standard practice for production apps
- Good balance of security and UX

**Cons:**
- More complex frontend logic (token refresh handling)
- Need to handle token expiry and refresh flows
- Additional testing surface area

## Architecture

### Backend Changes

**Configuration:**
- Keep `jwt()` and `bearer()` plugins in better-auth config (already present)
- Configure token expiry times:
  - Access token: 15 minutes
  - Refresh token: 7 days

**Middleware:**
- Update `requireAuth` middleware to:
  - Extract token from `Authorization: Bearer <token>` header
  - Validate using `auth.api.verifyJWT()`
  - Decode JWT payload to populate `req.auth`
  - Return 401 for invalid/missing tokens

### Frontend Changes

**Token Storage:**
- Access tokens: In-memory storage (cleared on page refresh)
- Refresh tokens: httpOnly cookies (managed by better-auth)
- Balances XSS protection with session persistence

**API Client:**
- Add request interceptor to inject Authorization header
- Add response interceptor to handle 401 and trigger refresh
- Implement single-flight pattern for concurrent refresh requests

**Auth Layer:**
- Update sign-in/sign-up to extract and store tokens
- Add token refresh function
- Update session management to use JWT decoding

## Components & File Changes

### Backend

**1. `src/middleware/require-auth.ts`**
- Replace `auth.api.getSession()` with `auth.api.verifyJWT()`
- Extract token from Authorization header
- Decode JWT to populate req.auth

**2. `src/lib/better-auth.ts`**
- Configure JWT expiry times in plugin options
- Ensure refresh token endpoint is enabled

### Frontend

**1. New: `frontend/src/lib/auth/token-store.ts`**
- In-memory token storage
- API: `getAccessToken()`, `setTokens()`, `clearTokens()`, `isTokenExpired()`

**2. `frontend/src/lib/api/client.ts`**
- Request interceptor: inject Authorization header
- Response interceptor: handle 401, trigger refresh, retry failed requests
- Single-flight refresh pattern

**3. `frontend/src/lib/api/auth.ts`**
- Update `signIn()` / `signUp()` to extract tokens from response
- Add `refreshAccessToken()` function
- Update `getSession()` to decode JWT locally

**4. `frontend/src/lib/queries/auth.ts`**
- Update session query for token-based validation
- Add refresh token logic

### Tests

**1. `tests/e2e/auth.e2e.test.ts`**
- Update to use Authorization headers instead of cookies
- Verify token response format

## Data Flow

### 1. Login Flow

```
User submits credentials
  ↓
Frontend POST /api/auth/sign-in/email
  ↓
Better-auth validates credentials
  ↓
Returns { accessToken, refreshToken, expiresIn, user }
  ↓
Frontend stores accessToken in memory
  ↓
Better-auth sets refreshToken as httpOnly cookie
  ↓
User is authenticated
```

### 2. API Request Flow

```
Frontend makes API request
  ↓
Interceptor adds Authorization: Bearer <accessToken>
  ↓
Backend middleware extracts token from header
  ↓
auth.api.verifyJWT() validates token
  ↓
If valid: decode user info, attach to req.auth, proceed
If invalid/expired: return 401
```

### 3. Token Refresh Flow

```
API request returns 401 (token expired)
  ↓
Response interceptor catches 401
  ↓
Call POST /api/auth/refresh (includes refresh token cookie)
  ↓
Better-auth validates refresh token
  ↓
Returns new { accessToken, expiresIn }
  ↓
Store new access token
  ↓
Retry original failed request with new token
```

### 4. Logout Flow

```
User clicks logout
  ↓
Clear in-memory access token
  ↓
POST /api/auth/sign-out (clears refresh token cookie)
  ↓
Redirect to login
```

## Error Handling

### 1. Expired Access Token
- API returns 401 Unauthorized
- Response interceptor automatically triggers refresh
- If refresh succeeds: retry original request
- If refresh fails: clear tokens, redirect to login

### 2. Invalid/Malformed Token
- Backend returns 401 with error code
- Frontend doesn't attempt refresh (token is corrupted)
- Clear tokens immediately, redirect to login

### 3. Refresh Token Expired
- Refresh endpoint returns 401
- Clear all tokens
- Show "Session expired, please log in again" message
- Redirect to login page

### 4. Network Errors During Refresh
- Retry refresh up to 2 times with exponential backoff
- If all retries fail: treat as expired session
- Preserve failed request queue to retry after manual re-login

### 5. Concurrent Request Handling
- Multiple 401s can happen simultaneously when token expires
- Implement single-flight pattern: only one refresh request in-flight
- Queue other requests, wait for refresh to complete
- All queued requests use new token once refresh succeeds

### 6. Token Storage Failures
- If unable to store token (rare): fallback to session-only mode
- Warn user they'll be logged out on page refresh
- Log error for monitoring

## Testing Strategy

### Tests to Update

**`tests/e2e/auth.e2e.test.ts`**
- Replace cookie-based assertions with token-based assertions
- Update sign-in tests to verify token response format
- Update authenticated request tests to use Authorization header

### New Tests to Add

**Backend: `tests/e2e/jwt-auth.e2e.test.ts`**
- Valid JWT token authentication
- Expired token returns 401
- Malformed token returns 401
- Missing Authorization header returns 401
- Token refresh endpoint works correctly
- Refresh token expiry handling

**Frontend: `frontend/src/lib/auth/token-store.test.ts`**
- Token storage and retrieval
- Token clearing
- Expiry time tracking

**Frontend: `frontend/src/lib/api/client.test.ts`**
- Authorization header injection
- 401 response triggers refresh
- Failed refresh clears tokens
- Concurrent request deduplication during refresh

### Test Scenarios

- Complete login-to-authenticated-request flow
- Token expiry and auto-refresh during active session
- Logout clears all tokens
- Page refresh loses access token (user stays logged in via refresh token)
- Refresh token expiry forces re-login
- Invalid token handling

## Security Considerations

1. **XSS Protection**: Access tokens in memory (not localStorage) to prevent XSS theft
2. **CSRF Protection**: Refresh tokens in httpOnly cookies, not accessible to JavaScript
3. **Token Expiry**: Short-lived access tokens (15 min) limit exposure window
4. **Secure Transport**: All tokens transmitted over HTTPS only
5. **Token Validation**: Server-side JWT signature verification on every request

## Migration Path

1. Implement JWT authentication in parallel (both methods work)
2. Update frontend to use JWT
3. Test thoroughly in staging
4. Deploy to production
5. Monitor for issues
6. Remove session-based code after validation period

## Success Metrics

- All existing auth e2e tests pass with JWT
- Token refresh works seamlessly (no user interruption)
- No session-related database queries on authenticated requests
- Auth errors are handled gracefully
- Token expiry doesn't disrupt user workflows

## Open Questions

None - design approved.
