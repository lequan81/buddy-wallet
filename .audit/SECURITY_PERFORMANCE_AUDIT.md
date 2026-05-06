# Security & Performance Audit

**Date:** May 4, 2026  
**Auditor:** Senior Security Engineer (5-10 years experience)  
**Scope:** apps/api, packages/* - Full codebase security & performance review  
**Status:** 🟡 MODERATE RISK - Issues found requiring attention

---

## Executive Summary

### Security Grade: B+ (Good, with improvement areas)
### Performance Grade: A- (Very good, minor optimizations needed)

**Critical Findings:** 2  
**High Priority:** 5  
**Medium Priority:** 8  
**Low Priority:** 4

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. Email Header Injection Vulnerability (SMTP Service)

**Location:** `apps/api/src/modules/auth/services/email.service.ts:52-68`

**Issue:** Template rendering doesn't sanitize user-controlled input before inserting into email headers/subject:

```typescript
// VULNERABLE - No sanitization of 'data' values
return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
  return data[key] || match;  // ❌ Direct interpolation
});
```

**Risk:** Email header injection (CRLF injection) if user input contains `\r\n` characters. Could allow:
- SMTP command injection
- Email spoofing
- BCC injection attacks

**Fix:**
```typescript
// Add header sanitization
function sanitizeEmailHeader(value: string): string {
  // Remove CRLF and other header-breaking characters
  return value.replace(/[\r\n\x00-\x1F\x7F]/g, '');
}

return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
  const value = data[key] || match;
  return sanitizeEmailHeader(String(value));
});
```

**Priority:** CRITICAL - Fix within 24 hours

---

### 2. Missing File Upload Path Traversal Protection

**Location:** `apps/api/src/modules/storage/services/s3.service.ts:13-36`

**Issue:** Path normalization doesn't prevent all path traversal attacks:

```typescript
const normalizeStoragePath = (rawPath: string): string =>
  rawPath.replace(/\\/g, '/').replace(/^\/+/, '');  // ❌ Insufficient
```

**Risk:** Path traversal via `../../../etc/passwd` or encoded sequences (`%2e%2e%2f`)

**Fix:**
```typescript
const normalizeStoragePath = (rawPath: string): string => {
  // Decode first to catch encoded attacks
  const decoded = decodeURIComponent(rawPath);
  
  // Remove null bytes and path traversal
  const clean = decoded
    .replace(/\\/g, '/')
    .replace(/\0/g, '')  // Remove null bytes
    .replace(/\/+/g, '/');  // Normalize slashes
  
  // Block path traversal patterns
  if (clean.includes('..')) {
    throw new Error('Path traversal detected');
  }
  
  return clean.replace(/^\/+/, '');
};
```

**Priority:** CRITICAL - Fix within 48 hours

---

## 🟠 HIGH PRIORITY SECURITY ISSUES

### 3. Error Messages Leak Internal Information

**Location:** `apps/api/src/bootstrap.ts:84-101` (Global error handler)

**Issue:** Error messages expose internal details in production:

```typescript
.onError(({ code, error, set }) => {
  logger.app('Global error caught', { code, error: String(error) });
  // ...
  return apiError(mapped.error, (error as Error)?.message);  // ❌ Leaks internals
})
```

**Risk:** Internal file paths, SQL queries, stack traces exposed to attackers

**Fix:**
```typescript
.onError(({ code, error, set }) => {
  const isProduction = configs.APP.IS_PRODUCTION;
  
  // Log full error internally
  logger.error('Request failed', { 
    code, 
    error: String(error),
    stack: (error as Error)?.stack  // Internal only
  });
  
  // Return safe message to client
  const safeMessage = isProduction 
    ? undefined  // Generic message from error catalog
    : (error as Error)?.message;  // Detailed in dev only
    
  return apiError(mapped.error, safeMessage);
})
```

**Priority:** HIGH - Fix within 1 week

---

### 4. Weak CORS in Development Mode

**Location:** `apps/api/src/commons/http/cors.middleware.ts:11-27`

**Issue:** Falls back to `http://localhost:5173` in production if `WEB_URL` not set:

```typescript
if (configs.APP.NODE_ENV === 'production' && !configs.APP.WEB_URL) {
  logger.error('FATAL: WEB_URL not set in production environment');
  throw new Error('WEB_URL environment variable is required in production');  // ❌ Still has fallback
}

const allowedOrigin = configs.APP.WEB_URL || 'http://localhost:5173';  // ❌ Dangerous fallback
```

**Risk:** If env var is empty string (not undefined), check passes but CORS is wide open

**Fix:**
```typescript
const webUrl = configs.APP.WEB_URL?.trim();
if (!webUrl) {
  logger.error('FATAL: WEB_URL not configured');
  throw new Error('WEB_URL required');
}

const allowedOrigins = webUrl.split(',').map(o => o.trim()).filter(Boolean);
if (allowedOrigins.length === 0) {
  throw new Error('WEB_URL must contain at least one valid origin');
}
```

**Priority:** HIGH

---

### 5. Missing Input Length Limits on Search/Filter Parameters

**Location:** Various handlers with query parameters

**Issue:** No validation on query string length, could cause:
- ReDoS (Regular Expression Denial of Service)
- Memory exhaustion from large inputs

**Example vulnerable pattern:**
```typescript
const { status, direction, sortBy } = query;  // ❌ No length validation
if (status) filterOptions.status = status;  // Could be 10MB string
```

**Fix:** Add middleware to validate input lengths:
```typescript
// Global validation middleware
.onBeforeHandle(({ request, set }) => {
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > 10 * 1024 * 1024) {  // 10MB limit
    set.status = 413;
    return apiError(BE_ERRORS.PAYLOAD_TOO_LARGE);
  }
  
  // Validate query parameter lengths
  const url = new URL(request.url);
  for (const [key, value] of url.searchParams) {
    if (value.length > 1000) {  // Max 1KB per param
      set.status = 400;
      return apiError(BE_ERRORS.INVALID_INPUT, `${key} too long`);
    }
  }
})
```

**Priority:** HIGH

---

### 6. Session Metadata Update Race Condition

**Location:** `apps/api/src/modules/auth/plugins/session-auth.plugin.ts:155-168`

**Issue:** Fire-and-forget session update without error handling or deduplication:

```typescript
// Background non-blocking update
Promise.resolve().then(async () => {
  try {
    await sessionRepo.update(sid, { lastActiveAt: new Date() });
  } catch (error) {
    logger.error(`Failed to update lastActiveAt for session ${sid}`, { error: String(error) });
  }
});
```

**Risk:**
- Multiple concurrent requests create race conditions
- Database write amplification (every request triggers write)
- No deduplication across requests

**Fix:** Use Redis for lastActive tracking, batch to DB periodically:
```typescript
// Update Redis only (fast), batch write to DB via worker
if (!session.lastActiveAt || session.lastActiveAt < fiveMinsAgo) {
  await sessionMetaCache.set(sid, { lastActiveAt: Date.now() });
  
  // Queue for batch DB update (not immediate)
  await batchUpdateQueue.add('session-activity', { sid, timestamp: Date.now() });
}
```

**Priority:** HIGH

---

## 🟡 MEDIUM PRIORITY SECURITY ISSUES

### 7. Missing Brute Force Protection on Password Reset

**Location:** `apps/api/src/modules/auth/handlers/password.handler.ts`

**Issue:** Password reset token validation doesn't have rate limiting. Attacker can brute force tokens.

**Fix:** Apply `authResetRateLimiter` to password reset endpoint.

---

### 8. JWT Token Not Rotated on Sensitive Operations

**Issue:** After password change, existing JWT tokens remain valid until expiry (15 minutes).

**Current:** Session version check only on next token refresh.

**Fix:** Implement shorter access token lifetime (5 min) or immediate blacklist on password change.

---

### 9. Missing HMAC for Webhook/Callback URLs

**Location:** Push notification and external service callbacks

**Issue:** No signature verification on incoming webhooks, could allow forged notifications.

---

### 10. SQL Query Timing Attack Vulnerability

**Location:** `apps/api/src/repositories/user/user.repo.ts:86-94`

**Issue:** `findByPhoneWithPassword` and `findByEmailWithPassword` use different queries:

```typescript
async findByPhoneWithPassword(phone: string): Promise<User | null> {
  const user = await this.database.select().from(users).where(eq(users.phoneNumber, phone)).get();
  return user || null;
}
```

**Risk:** Timing differences between "user not found" and "wrong password" could leak user existence.

**Fix:** Use constant-time comparison or always perform password hash operation:
```typescript
// Always hash password even if user not found (prevents timing attack)
const dummyHash = '$argon2id$...';  // Pre-computed dummy hash
const user = await this.findByPhone(phone);
const hashToCheck = user?.password || dummyHash;
await verifyPassword(password, hashToCheck);  // Always runs
```

---

### 11. Insufficient Logging of Sensitive Operations

**Issue:** Missing audit logs for:
- Failed password reset attempts
- Failed OTP verifications (not logged with enough context)
- Permission escalation attempts

---

### 12. Missing Content-Type Validation on File Uploads

**Location:** File upload handlers

**Issue:** Content-Type header is trusted without validation against file magic numbers.

**Risk:** MIME type spoofing attacks (upload `.php` as `image/jpeg`).

**Fix:** Use `file-type` library to validate file magic numbers.

---

### 13. Redis Security Configuration Not Verified

**Issue:** No verification that Redis is configured with:
- AUTH password in production
- TLS/SSL encryption
- Network isolation (not exposed to internet)

---

### 14. Missing Database Connection Encryption

**Issue:** SQLite is local file (fine), but no verification that S3 connections use HTTPS.

---

## 🟢 LOW PRIORITY SECURITY ISSUES

### 15. Information Disclosure via Error Stack Traces in Dev

**Issue:** Stack traces enabled in development mode could leak to production if misconfigured.

**Fix:** Ensure `NODE_ENV` check is robust, not just string comparison.

---

### 16. X-Powered-By Header Not Removed

**Issue:** Elysia may expose framework version in `X-Powered-By` header.

**Fix:** Add middleware to remove fingerprinting headers.

---

### 17. Subdomain Cookie Sharing Risk

**Issue:** Cookies may be accessible across subdomains if not scoped properly.

---

### 18. Missing Security.txt File

**Issue:** No security contact information for responsible disclosure.

---

## PERFORMANCE AUDIT

### Strengths ✅

| Area | Implementation | Grade |
|------|---------------|-------|
| **N+1 Prevention** | Batch queries with `findByIds`, `Promise.all()` for counts | A |
| **Caching** | Redis for sessions, JWT blacklist, rate limits | A |
| **Query Optimization** | Parallel queries, selective columns | A- |
| **Pagination** | Proper LIMIT/OFFSET with COUNT(*) | A |
| **Image Processing** | Sharp library for optimized image handling | B+ |
| **Compression** | ETag support for HTTP caching | B+ |

### Issues Found

#### 1. Missing Database Index on `importLogs.userId`

**Location:** `apps/api/src/repositories/data/import.repo.ts:52-64`

Query filters by `userId` but no index shown in schema. Full table scan on large imports.

**Fix:** Add index:
```sql
CREATE INDEX idx_import_logs_user_id ON import_logs(user_id);
```

---

#### 2. Inefficient UUID Generation

**Location:** Various files using `crypto.randomUUID()` or `randomUUIDv7()`

**Issue:** `crypto.randomUUID()` is slower than `Bun.randomUUIDv7()` which you're already using, but some files still use `crypto.randomUUID()`.

**Fix:** Standardize on `randomUUIDv7()` for better performance and sortability.

---

#### 3. JSON Parsing Without Try-Catch in Worker

**Location:** `apps/api/src/workers/import.worker.ts:150`

```typescript
parsedData = JSON.parse(buffer.toString());  // ❌ Could crash worker
```

**Fix:** Wrap in try-catch with proper error logging.

---

#### 4. Memory Leak in Session Cache Scan

**Location:** `apps/api/src/repositories/cache/session.cache.ts:75-106`

**Issue:** `invalidateAllForUser` uses `SCAN` but doesn't limit memory usage. Could exhaust memory with large keyspaces.

**Fix:** Add timeout and memory limits to scan operation.

---

#### 5. Blocking Operations in Hot Path

**Location:** `apps/api/src/modules/auth/plugins/session-auth.plugin.ts:49`

**Issue:** Token hashing is async but runs on every request:

```typescript
const tokenHash = await hashToken(token);  // ❌ Blocks request
```

**Fix:** Use faster hash (e.g., `Bun.hash()` with xxhash64) for rate limiting cache keys, reserve SHA-256 for DB storage.

---

#### 6. Missing Connection Pooling for S3

**Issue:** S3 client may not reuse connections efficiently under high load.

**Fix:** Verify HTTP keep-alive settings on S3 client.

---

#### 7. Regex Compilation on Every Request

**Location:** Various validation functions

**Issue:** Some regex patterns are compiled on every function call instead of being pre-compiled.

**Example:**
```typescript
// Inefficient - compiles regex every call
if (!/[A-Z]/.test(password)) { ... }
```

This is actually fine for simple regexes in V8, but for complex patterns, pre-compile:

```typescript
const UPPERCASE_REGEX = /[A-Z]/;
if (!UPPERCASE_REGEX.test(password)) { ... }
```

---

## DEPENDENCY SECURITY

### Package Analysis

| Package | Version | Risk | Notes |
|---------|---------|------|-------|
| `elysia` | ^1.4.28 | Low | Keep updated |
| `@elysiajs/jwt` | ^1.4.1 | Low | Monitor for CVEs |
| `exceljs` | ^4.4.0 | Medium | Large dependency tree, check for vulnerabilities |
| `sharp` | ^0.34.5 | Low | Native module, keep updated |
| `web-push` | ^3.6.7 | Low | Check VAPID key handling |
| `@sinclair/typebox` | ^0.34.8 | Low | Type validation library |

### Recommendations

1. Enable Dependabot or Snyk for automated vulnerability alerts
2. Pin exact versions in production (`"elysia": "1.4.28"` not `"^1.4.28"`)
3. Regular `bun audit` or `npm audit`

---

## SECURITY HEADER ANALYSIS

### Current Implementation: Good ✅

```typescript
// From security-headers.middleware.ts
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy: [Well-configured]
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: [Appropriate restrictions]
```

### Missing Headers

- `X-DNS-Prefetch-Control: off` (privacy)
- `Cross-Origin-Resource-Policy: same-origin` (Spectre mitigation)
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` (popup security)

---

## AUTHENTICATION FLOW SECURITY

### Password Hashing: Excellent ✅

- Algorithm: Argon2id (recommended by OWASP)
- Memory cost: 65536 KB (good)
- Time cost: 3 iterations (acceptable)

### JWT Implementation: Good ✅

- Short-lived access tokens (15 min)
- Refresh token rotation
- Session versioning for instant invalidation
- Issuer/audience validation
- Token hashing before DB storage

### Areas for Improvement:

1. **Binding refresh tokens to device fingerprint** (prevents token theft reuse)
2. **IP-based anomaly detection** (alert on login from new location)
3. **Concurrent session limits** (prevent session flooding)

---

## IMMEDIATE ACTION ITEMS (Next 7 Days)

1. **CRITICAL:** Fix email header injection (`email.service.ts`)
2. **CRITICAL:** Add path traversal protection (`s3.service.ts`)
3. **HIGH:** Sanitize error messages in production (`bootstrap.ts`)
4. **HIGH:** Fix CORS fallback vulnerability
5. **HIGH:** Add rate limiting to password reset endpoint
6. **MEDIUM:** Implement input length validation middleware
7. **MEDIUM:** Add database indexes for import logs

---

## LONG-TERM HARDENING (Next 30 Days)

1. Implement WebAuthn/Passkey support
2. Add WAF (Web Application Firewall) rules
3. Implement security event SIEM integration
4. Add automated security scanning to CI/CD
5. Conduct penetration testing
6. Implement feature flags for security-critical changes

---

## SECURITY CHECKLIST

| Control | Status | Notes |
|---------|--------|-------|
| Input validation | ✅ | TypeBox schemas |
| Output encoding | ✅ | escapeHtml utility |
| Parameterized queries | ✅ | Drizzle ORM |
| Authentication | ✅ | JWT + sessions |
| Authorization | ✅ | RBAC with permissions |
| CSRF protection | ✅ | Bun.CSRF + origin checks |
| Rate limiting | ✅ | Multi-tier implementation |
| Security headers | ✅ | Comprehensive CSP |
| Logging/monitoring | ✅ | Structured security logs |
| Error handling | ⚠️ | Needs hardening |
| File upload | ⚠️ | Needs path validation |
| Email security | ❌ | Header injection vulnerability |
| Secrets management | ✅ | Environment-based |
| Dependency management | ⚠️ | Needs automated scanning |

**Overall Security Posture:** Good foundation with critical fixes needed.

---

**End of Audit**
