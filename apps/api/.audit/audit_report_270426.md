# 🔍 Comprehensive Backend Audit Report

**Date:** 2026-04-27  
**Scope:** `apps/api/src/` — Structure, Business Logic, SQL Performance, Security

---

## Executive Summary

| Category | Findings | Critical | High | Medium | Low |
|----------|----------|----------|------|--------|-----|
| 1. Structure | 8 | 0 | 3 | 4 | 1 |
| 2. Business Logic | 10 | 3 | 5 | 2 | 0 |
| 3. SQL / Query Performance | 5 | 1 | 2 | 2 | 0 |
| 4. Security | 9 | 4 | 3 | 2 | 0 |
| **Total** | **32** | **8** | **13** | **10** | **1** |

---

## 1. Folder Structure Issues

### STR-01 · Dual Entry Points (index.ts vs bootstrap.ts) — 🔴 HIGH

Both [index.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/index.ts) and [bootstrap.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/bootstrap.ts) create and configure the Elysia app independently. They duplicate middleware registration (cors, csrf, security headers, error handler, redis, telemetry) and **register modules differently**:

- `index.ts` mounts modules flat (no auth guard, no `/v1` prefix)
- `bootstrap.ts` uses `registerApiRoutes()` which wraps in `/v1` with auth guard

**Impact:** Depending on which file starts the app, routes either have or lack authentication and API versioning.

**Fix:** Delete one. Keep `bootstrap.ts` as the canonical entry, update `index.ts` to just call `bootstrap()`.

---

### STR-02 · Dual Route Definitions Per Module — 🔴 HIGH

Every module has **both** a `routes.ts` and a `routes/` subdirectory with a separate `*.routes.ts`:

| Module | New FP routes | Legacy controller-style routes |
|--------|---------------|-------------------------------|
| auth | `routes.ts` (uses schema imports) | `routes/auth.routes.ts` (inline `t.Object`) |
| debts | `routes.ts` | `routes/debt.routes.ts` |
| user | `routes.ts` | `routes/user.routes.ts` |
| bank | `routes.ts` | `routes/bank.routes.ts` |
| storage | `routes.ts` | `routes/storage.routes.ts` |
| data | `routes.ts` | `routes/data.routes.ts` |

The `index.ts` barrels import from `routes.ts`, so the `routes/` subdirectories are **dead code** that still contains inline schema definitions (not using the centralized `schema.ts`).

**Fix:** Delete all `routes/` subdirectories inside modules. They are unused leftovers.

---

### STR-03 · Legacy `src/lib/` Still Referenced — 🔴 HIGH

`src/lib/http/index.ts` exports `apiError()` and `apiSuccess()` which are imported by:
- [app.ts:L26](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/app.ts#L26)
- [bootstrap.ts:L31](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/bootstrap.ts#L31)
- [web.ts:L3](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/routes/web.ts#L3)
- [actor.plugin.ts:L30](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/plugins/actor.plugin.ts#L30)

ARCHITECTURE.md says `src/lib/` is legacy and should be deleted, but these helpers are still actively used.

**Fix:** Move `apiError`/`apiSuccess` to `src/commons/http/response.ts`, update imports, then delete `src/lib/`.

---

### STR-04 · Module Naming Mismatch vs ARCHITECTURE.md — 🟡 MEDIUM

| ARCHITECTURE.md says | Actual directory |
|---------------------|-----------------|
| `modules/users/` | `modules/user/` |
| `modules/notifications/` | `modules/notification/` |

**Fix:** Rename to plural form to match ARCHITECTURE.md, or update ARCHITECTURE.md to match the singular convention.

---

### STR-05 · `src/routes/` Still Exists — 🟡 MEDIUM

ARCHITECTURE.md marks `src/routes/` as "to be removed" (Phase 6). It currently contains `api.ts` and `web.ts`. The `api.ts` is used by `bootstrap.ts` but not by `index.ts`. `web.ts` health routes should move to `modules/system/`.

**Fix:** Inline `registerApiRoutes` into `bootstrap.ts`, move health check routes to system module, delete `src/routes/`.

---

### STR-06 · `commons/security/ip/` Undocumented — 🟡 MEDIUM

There's a `src/commons/security/ip/` subdirectory with `extract.ts`, `parse.ts`, `validate.ts` that is not mentioned in ARCHITECTURE.md. Contains IP validation, cloud provider range matching (with TODO for CIDR).

**Fix:** Document in ARCHITECTURE.md under `commons/security/`.

---

### STR-07 · `auth/types/` Contains Handler-Specific Types — 🟡 MEDIUM

[handler.types.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/types/handler.types.ts) exists in `auth/types/` and `debts/types/`. ARCHITECTURE.md says module-specific types go in `types/` subfolder, but these are handler-level request body types that should be derived from TypeBox schemas.

**Fix:** Derive types from schemas using `Static<typeof Schema>` instead of maintaining separate type files.

---

### STR-08 · Inconsistent Handler Patterns — 🟢 LOW

`auth` and `user` modules use **class-based** handlers (`AuthHandler`, `UserHandler`) with `.bind()` exports, while `debts`, `bank`, `storage`, `notification`, `data` use **standalone arrow functions**. ARCHITECTURE.md prescribes the functional pattern.

**Fix:** Refactor `AuthHandler` and `UserHandler` classes to standalone exported functions.

---

## 2. Missing / Placeholder Business Logic

### BIZ-01 · Password Reset is Completely Broken — 🔴 CRITICAL

[auth.handler.ts:L341-L371](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L341-L371)

**`requestPasswordReset`**: Generates a token and hashes it (`_tokenHash`, `_expiresAt`) but **never stores it** — the repository call is commented out:
```typescript
// Store reset token (you'll need to add this to your schema)
// await passwordResetRepo.create({ userId: user.id, tokenHash, expiresAt });
```

**`resetPassword`**: Has a `TODO` comment and **returns `{ success: true }` without doing anything**:
```typescript
// TODO: Implement password reset with password reset repository
return { success: true };
```

**Impact:** Users cannot reset their passwords. The endpoint returns success but nothing happens.

---

### BIZ-02 · Email Sending is a No-Op — 🔴 CRITICAL

[email.service.ts:L54-L80](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/email.service.ts#L54-L80)

`sendEmail()` is marked "Placeholder implementation" — it generates a fake `messageId` and returns `{ success: true }` without sending anything. This means:
- OTP verification emails are never sent
- Password reset emails are never sent
- All email-dependent flows silently fail

---

### BIZ-03 · Import/Export Data Handlers Return Empty — 🔴 CRITICAL

[data.handler.ts:L55-L61](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/data/handlers/data.handler.ts#L55-L61)

Both `exportDataHandler` and `importDataHandler` are stubs:
```typescript
// Placeholder - actual implementation would fetch data from repositories
const data: any[] = [];
```
```typescript
// Placeholder - actual implementation would import data to repositories
const imported = 0;
```

**Impact:** Export always returns empty data. Import always returns 0 imported, 0 failed.

---

### BIZ-04 · Debt Delete Handler Never Deletes — 🟠 HIGH

[debt.handler.ts:L354-L357](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/handlers/debt.handler.ts#L354-L357)

```typescript
// Placeholder - delete method doesn't exist on repository
// await debtRepo.delete(id);
return { success: true };
```

The debt passes all validation checks but is never actually deleted. `softDelete()` exists on the repo but isn't called.

---

### BIZ-05 · Login Missing Account Lockout — 🟠 HIGH

[auth.handler.ts:L158-L227](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L158-L227)

UX_Flow says: "Check account lockout status" and "Track failed attempts (lock after 5)". The handler:
- ❌ Never checks `user.isLocked` or `user.lockoutUntil`
- ❌ Never increments `failedLoginAttempts` on wrong password
- ❌ Never calls `resetFailedAttempts()` on success

The repo has `updateLockoutStatus()` and `resetFailedAttempts()` methods, but they're never called.

---

### BIZ-06 · Password Change Doesn't Invalidate Sessions — 🟠 HIGH

[user.handler.ts:L78-L114](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/user/handlers/user.handler.ts#L78-L114)

UX_Flow says: "Increment session version (invalidates all sessions)" and "Revoke all other sessions". The handler:
- ❌ Never increments `sessionVersion`
- ❌ Never calls `sessionRepo.revokeActiveSessionsForUser()`
- Only updates the password hash

**Impact:** After password change, all old sessions remain valid. A compromised session stays alive.

---

### BIZ-07 · `countByUserId` Returns Hardcoded Zeros — 🟠 HIGH

[debt.repo.ts:L228-L245](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/debt.repo.ts#L228-L245)

```typescript
return {
  total: totalResult?.count ?? 0,
  pending: 0,    // ← hardcoded
  completed: 0   // ← hardcoded
};
```

Only `total` is queried. `pending` and `completed` always return 0.

---

### BIZ-08 · Health Check Always Returns "healthy" — 🟠 HIGH

[health.service.ts:L37-L56](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/system/services/health.service.ts#L37-L56)

```typescript
const databaseStatus = 'up';  // hardcoded
const storageStatus = 'up';   // hardcoded
```

No actual connectivity checks. `getStorageLiveReadiness()` queries the DB but never checks actual S3/storage.

---

### BIZ-09 · Verify Email Uses Wrong Lookup — 🟡 MEDIUM

[auth.handler.ts:L290](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L290)

```typescript
const verification = await emailVerificationRepo.findById(token);
```

The handler receives a `token` (OTP code) in the body but passes it as an **ID** to `findById()`. The OTP should be verified against the hash, not used as a primary key lookup.

---

### BIZ-10 · Data Handler Checks `'error' in` Instead of `'code' in` — 🟡 MEDIUM

[data.handler.ts:L36](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/data/handlers/data.handler.ts#L36)

```typescript
if ('error' in typeValidation) {  // wrong — Result type uses 'code'
```

The `Result<T>` type returns `{ code: string }` for errors, not `{ error: string }`. These checks will **never match**, so validation errors silently pass through.

---

## 3. SQL / Query Performance Issues

### SQL-01 · `findMany` Counts by Fetching All Rows — 🔴 CRITICAL

[user.repo.ts:L15-L27](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/user.repo.ts#L15-L27)

```typescript
const allUsers = await this.database.select().from(users).all();
const total = allUsers.length;
```

Fetches **every user row** just to get a count. With 10K+ users this loads all data into memory.

**Fix:**
```typescript
const [{ count: total }] = await this.database
  .select({ count: count() }).from(users).all();
```

---

### SQL-02 · Duplicate Detection Fetches All Then Filters In-Memory — 🟠 HIGH

[debt.repo.ts:L116-L148](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/debt.repo.ts#L116-L148)

`findPotentialDuplicates` ignores `_daysBack` parameter (unused), fetches all matching debts, then filters by amount tolerance in JS. The date filter should be a SQL `WHERE` clause, and amount tolerance could use `BETWEEN`.

**Fix:** Add `gte(debts.createdAt, cutoffDate)` to the query and use SQL `BETWEEN` for amount range.

---

### SQL-03 · `revokeAllForUser` Queries Before Update — 🟠 HIGH

[session.repo.ts:L85-L98](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/session.repo.ts#L85-L98)

```typescript
const activeSessions = await this.findActiveByUserId(userId); // SELECT
await this.database.update(sessions)...  // UPDATE
return activeSessions;
```

Does a full SELECT first (unused by callers), then a separate UPDATE. Also ignores `_exceptSessionId` parameter.

**Fix:** Just do the UPDATE with `.returning()` and use `ne(sessions.id, exceptSessionId)` when provided.

---

### SQL-04 · `listBankAccountsHandler` Ignores Pagination — 🟡 MEDIUM

[bank.handler.ts:L89-L105](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/bank/handlers/bank.handler.ts#L89-L105)

Accepts `page` and `limit` query params, calculates pagination metadata, but `findByUserId()` fetches **all accounts** without limit/offset. Pagination metadata is calculated on the full result.

---

### SQL-05 · `markAsRead` N+1 Query — 🟡 MEDIUM

[notification.handler.ts:L73-L93](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/notification/handlers/notification.handler.ts#L73-L93)

```typescript
for (const id of notificationIds) {
  const notification = await notificationRepo.findById(id); // 1 query per ID
```

Each notification is fetched individually in a loop to verify ownership. Should batch-fetch with `findByIds()` and check all at once.

---

## 4. Security Vulnerabilities

### SEC-01 · OTP Generated with `Math.random()` — 🔴 CRITICAL

[auth.service.ts:L31-L33](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts#L31-L33)

```typescript
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
```

`Math.random()` is **not cryptographically secure**. OTPs are predictable. An attacker who can observe timing or has partial state knowledge can predict future OTPs.

**Fix:**
```typescript
import { randomInt } from 'node:crypto';
export function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}
```

---

### SEC-02 · Login Missing Dummy Hash (Timing Attack) — 🔴 CRITICAL

[auth.handler.ts:L178-L188](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L178-L188)

```typescript
if (!user) {
  set.status = 401;
  return BE_ERRORS.AUTH_INVALID_CREDENTIALS;  // fast return
}
const isValid = await verifyPassword(password, user.password);  // slow hash
```

When a user doesn't exist, the handler returns **immediately**. When they do exist, it takes ~200ms for Argon2 verification. An attacker can measure response times to enumerate valid accounts.

**Fix:** Always run a dummy hash when user is not found:
```typescript
if (!user) {
  await verifyPassword(password, DUMMY_HASH); // constant-time
  set.status = 401;
  return BE_ERRORS.AUTH_INVALID_CREDENTIALS;
}
```

---

### SEC-03 · Refresh Token Stored & Compared in Plaintext — 🔴 CRITICAL

[session.repo.ts:L18-L25](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/session.repo.ts#L18-L25)

```typescript
async findActiveByRefreshToken(hash: string): Promise<DBSession | null> {
  // ...eq(sessions.refreshToken, hash)...
```

Despite the parameter name `hash`, the actual refresh token value is stored and compared directly in the DB (see [auth.handler.ts:L129](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L129): `accessToken: tokens.accessToken`). If the DB is compromised, all refresh tokens are exposed.

**Fix:** Store only `sha256(refreshToken)` in the DB. Hash the incoming token before comparison.

---

### SEC-04 · Access Token Stored in Plain Text in Session — 🔴 CRITICAL

[auth.handler.ts:L126-L145](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L126-L145)

```typescript
await sessionRepo.create({
  accessToken: tokens.accessToken,     // plain text!
  accessTokenHash,                      // hash also stored
  refreshToken: tokens.refreshToken,   // plain text!
```

Both access and refresh tokens are stored in plaintext alongside their hashes. The `accessTokenHash` is used for lookup, but the plaintext columns mean a DB breach exposes all active tokens.

**Fix:** Remove plaintext `accessToken` and `refreshToken` columns. Store only hashes.

---

### SEC-05 · Password Reset Leaks User Existence — 🟠 HIGH

[auth.handler.ts:L336-L339](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L336-L339)

```typescript
if (!user.email) {
  set.status = 400;
  return { code: 'AUTH_NO_EMAIL', message: 'User does not have an email address' };
}
```

The handler returns `{ success: true }` when user not found (good), but returns a **400 with specific error** when user exists but has no email. This reveals that the account exists.

**Fix:** Return `{ success: true }` in all cases. Log the no-email case server-side only.

---

### SEC-06 · `generateTokens` Ignores userId — 🟠 HIGH

[auth.service.ts:L91-L98](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts#L91-L98)

```typescript
export function generateTokens(_userId: string): { ... } {
  const accessToken = generateSecureToken();
  const refreshToken = generateSecureToken();
```

The `_userId` parameter is prefixed with underscore (unused). This function generates **random opaque tokens, not JWTs**. But `session-auth.plugin.ts` calls `jwt.verify(token)` expecting a JWT payload with `id`, `sessionVersion`, `iss`, `aud`.

**Impact:** The session auth plugin expects JWT tokens with claims, but the auth handler creates opaque random tokens. This is a fundamental mismatch — either login/register is broken, or there's a separate JWT signing step that's missing.

---

### SEC-07 · Inconsistent Token Hashing (SHA256 vs bcrypt) — 🟠 HIGH

Two `hashToken` functions exist with **different algorithms**:

| Location | Algorithm | Used by |
|----------|-----------|---------|
| [commons/security/password.ts:L117](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/commons/security/password.ts#L117) | SHA-256 (fast) | `session-auth.plugin.ts` |
| [auth.service.ts:L81](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts#L81) | bcrypt cost=4 (slow) | `auth.handler.ts` |

The handler hashes the access token with **bcrypt** and stores it as `accessTokenHash`. The session-auth plugin hashes the incoming token with **SHA-256** and looks up by `accessTokenHash`. **These will never match** because different algorithms produce different outputs.

**Impact:** Session authentication is likely broken unless there's an alternate lookup path.

---

### SEC-08 · File Access Control via String Contains — 🟡 MEDIUM

[storage.handler.ts:L76](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/storage/handlers/storage.handler.ts#L76)

```typescript
if (!key.includes(user.id)) {
  return BE_ERRORS.PERMISSION_DENIED;
}
```

Ownership is checked by whether the file key **contains** the user ID string. A user with ID `abc` could access files belonging to user `abcdef` (substring match).

**Fix:** Use proper path-based ownership: `key.startsWith(\`uploads/${user.id}/\`)`.

---

### SEC-09 · CSRF Secret Falls Back to JWT Secret — 🟡 MEDIUM

[auth.ts:L12](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/config/auth.ts#L12)

```typescript
CSRF_SECRET: env.string('CSRF_SECRET', jwtSecret),
```

If `CSRF_SECRET` env var is not set, it defaults to the JWT secret. Compromising one compromises the other.

**Fix:** Require separate secrets or generate a derived key.

---

## Summary of Required Actions

### Immediate (Security-Critical)
1. **SEC-01**: Replace `Math.random()` OTP with `crypto.randomInt()`
2. **SEC-02**: Add dummy Argon2 hash on user-not-found login path
3. **SEC-07**: Unify token hashing to single algorithm (SHA-256 for lookups)
4. **SEC-03/04**: Stop storing plaintext tokens in session table
5. **BIZ-01**: Implement password reset token storage and verification

### High Priority (Broken Features)
6. **BIZ-02**: Integrate real email provider (Resend/SendGrid)
7. **BIZ-05**: Implement account lockout logic in login handler
8. **BIZ-06**: Add session invalidation to password change handler
9. **SQL-01**: Fix `findMany` to use SQL `COUNT(*)` instead of full table scan
10. **STR-01**: Eliminate dual entry point ambiguity

### Medium Priority (Cleanup)
11. **STR-02**: Delete dead `routes/` subdirectories in modules
12. **STR-03**: Move `apiError`/`apiSuccess` out of legacy `src/lib/`
13. **BIZ-03/04**: Implement data import/export and debt deletion
14. **BIZ-10**: Fix `'error' in` → `'code' in` checks in data handler
15. **SEC-05**: Fix password reset user enumeration leak
