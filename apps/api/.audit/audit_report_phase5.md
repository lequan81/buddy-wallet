# Phase 5 Audit Report — `apps/api` Codebase Quality Review

> **Generated**: 2026-04-27  
> **Scope**: All modules, services, handlers, repositories, and commons in `apps/api/src/`

---

## 1. Bad Practices, Bad Logic, Bad Performance

### 1.1 🔴 `SmtpTransport` recreated on every email send

**File**: [email.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/email.service.ts#L56-L72)

Every call to `sendEmail()` creates a new `SmtpTransport` instance — meaning a new TCP connection, TLS handshake, and SMTP AUTH on _every single email_. For registration and password reset flows this causes unnecessary latency.

```typescript
// ❌ Current — new transport per call
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const transport = new SmtpTransport({ ... }); // line 64
  const email = createMessage({ ... });
  await transport.send(email);
}
```

**Fix**: Create a singleton transport at module scope, or lazy-initialize it once.

---

### 1.2 🔴 `hashPassword` and `verifyPassword` are duplicated across two files

**Files**:
- [auth.service.ts:67-76](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts#L67-L76)
- [password.ts:135-143](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/commons/security/password.ts#L135-L143)

Both files export identical `hashPassword` and `verifyPassword` functions. `auth.handler.ts` imports from `auth.service.ts`, while `user.handler.ts` imports from `commons/security/password.ts`. This is confusing and violates the single-source-of-truth principle.

**Fix**: Keep only the `commons/security/password.ts` versions. Remove from `auth.service.ts` and update `auth.handler.ts` imports.

---

### 1.3 🔴 `hashToken` duplicated across two files

**Files**:
- [auth.service.ts:81-85](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts#L81-L85)
- [password.ts:117-121](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/commons/security/password.ts#L117-L121)

Same issue — identical `hashToken` function exported from two locations.

**Fix**: Keep only in `commons/security/password.ts`. Update all consumers.

---

### 1.4 🔴 `redactIdentifier` duplicated across two files

**Files**:
- [auth.service.ts:148-154](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts#L148-L154)
- [password.ts:105-112](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/commons/security/password.ts#L105-L112)

**Fix**: Keep only in `commons/security/password.ts`.

---

### 1.5 🟡 `calculatePagination` duplicated in 4 services

**Files**:
- [debt.service.ts:118-125](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/debt.service.ts#L118-L125)
- [bank.service.ts:69-76](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/bank/services/bank.service.ts#L69-L76)
- [user.service.ts:109-116](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/user/services/user.service.ts#L109-L116)
- [notification.service.ts:57-64](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/notification/services/notification.service.ts#L57-L64)
- [storage.service.ts:91-98](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/storage/services/storage.service.ts#L91-L98)

All 5 are identical copies of the same 8-line function.

**Fix**: Move to `commons/pagination.ts` (or add to existing `commons/index.ts`) and import everywhere.

---

### 1.6 🟡 `validateOtp` in `auth.service.ts` uses wrong hashing method

**File**: [auth.service.ts:141-143](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts#L141-L143)

```typescript
export function validateOtp(otp: string, otpHash: string): boolean {
  return Bun.password.verifySync(otp, otpHash);
}
```

OTPs are hashed with `SHA-256` via `hashToken()`, but this function tries to verify with `Bun.password.verifySync` (Argon2). These are incompatible. This function is never called (the handler uses `hashToken + DB lookup` directly), but it's a correctness trap if anyone uses it.

**Fix**: Delete it — it's unused and incorrect.

---

### 1.7 🟡 `ActivityRepository.findMany` and `findManyByUserId` — SELECT all rows for count

**File**: [activity.repo.ts:38-42, 64-67](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/activity.repo.ts#L38-L42)

```typescript
const allActivities = await this.database.select().from(activityLogs).all();
const count = allActivities.length;
```

This fetches *every single activity log row* into memory just to get a count. This will degrade massively as data grows.

**Fix**: Use `SELECT COUNT(*)` like the debt repo and bank-account repo already do.

---

### 1.8 🟡 `ImportRepository.getLogsPaginated` — same SELECT-all-for-count pattern

**File**: [import.repo.ts:59-63](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/import.repo.ts#L59-L63)

**Fix**: Same as above — use `SELECT COUNT(*)`.

---

### 1.9 🟡 `ImportRepository.deleteLogsByStatus` always returns `0`

**File**: [import.repo.ts:77-86](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/import.repo.ts#L77-L86)

```typescript
async deleteLogsByStatus(...): Promise<number> {
    await this.database.delete(importLogs).where(...);
    return 0; // ← always zero
}
```

**Fix**: Use `.returning()` and return `result.length`.

---

### 1.10 🟡 `storage.handler.ts` — `listFilesHandler` fetches ALL files, paginate in JS

**File**: [storage.handler.ts:112-113](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/storage/handlers/storage.handler.ts#L112-L113)

```typescript
const files = await fileRepo.findByUserIdAndType(user.id, 'all');
```

Fetches all files, then calls `calculatePagination(files.length, ...)` — but never slices the result. The `page` and `limit` params are accepted from the query but completely ignored.

**Fix**: Add pagination support to `FileRepository.findByUserIdAndType()`, or create a new paginated method.

---

### 1.11 🟡 `storage.handler.ts` — `deleteFileHandler` missing HTTP status on permission error

**File**: [storage.handler.ts:76-78](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/storage/handlers/storage.handler.ts#L76-L78)

```typescript
if (!key.startsWith(`uploads/${user.id}/`)) {
    return BE_ERRORS.PERMISSION_DENIED; // ← no set.status = 403
}
```

Same issue in `getFileUrlHandler` at line 93-95.

**Fix**: Add `set.status = 403;` before the return. The function destructures `set` as `_set` so it can't even be used.

---

## 2. Duplicated or Bad Types / Not Using Shared Types

### 2.1 🔴 `user.service.ts` has a `sanitizeUser` that duplicates `toSafeUser`

**File**: [user.service.ts:101-104](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/user/services/user.service.ts#L101-L104)

```typescript
export function sanitizeUser(user: any) {
  const { password, ...sanitized } = user;
  return sanitized;
}
```

This is functionally identical to `toSafeUser` in `commons/security/password.ts`. It's never imported anywhere.

**Fix**: Delete `sanitizeUser`. Use `toSafeUser` from commons.

---

### 2.2 🟡 `canUpdateUser` and `canDeleteUser` in user.service.ts are never used

**File**: [user.service.ts:75-96](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/user/services/user.service.ts#L75-L96)

The handlers do inline `user.role !== 'admin'` checks instead. These service functions are dead code.

**Fix**: Either use them in the handlers (better), or delete them.

---

### 2.3 🟡 `canSetDefaultAccount` in bank.service.ts is never used

**File**: [bank.service.ts:62-64](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/bank/services/bank.service.ts#L62-L64)

The handler does inline `user.id !== bankAccount.userId` checks instead.

**Fix**: Either use it, or delete it.

---

### 2.4 🟡 Not using `SafeUser` type from `@repo/types`

**File**: [password.ts:96-100](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/commons/security/password.ts#L96-L100)

`toSafeUser` returns `Record<string, unknown> | null` — extremely loose. There is a `SafeUser` type already defined in `@repo/types` that should be used here for type safety.

---

### 2.5 🟡 `Pagination` type from `@repo/types` not used in services

All 5 copies of `calculatePagination` return an anonymous inline type. The `@repo/types` package already exports `Pagination` interface. Using it would provide type consistency.

---

### 2.6 🟡 Handler context types all use `any`

Every single handler across all modules uses `: any` for the context parameter, with eslint-disable comments. While this was expedient, it means no compile-time safety on accessing `user.id`, `body.email`, etc.

**Fix (Long-term)**: Create a shared `AuthenticatedContext` type and use it.

---

## 3. Misplaced Imports

### 3.1 🔴 `auth.service.ts` re-exports utilities that belong in commons

**File**: [auth.service.ts](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts)

This service file re-exports `normalizePhoneNumber` from `@repo/utils` (line 157), and exports `hashPassword`, `verifyPassword`, `hashToken`, `redactIdentifier` which are duplicates of `commons/security/password.ts`. The auth handler imports everything from the service instead of from commons.

**Fix**: Auth handler should import crypto utilities from `commons/security/password` and phone normalization from `@repo/utils` directly.

---

### 3.2 🟡 `data.handler.ts` imports `Elysia` but never uses it

**File**: [data.handler.ts:11](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/data/handlers/data.handler.ts#L11)

```typescript
import { Elysia } from 'elysia'; // unused
```

---

### 3.3 🟡 `data.handler.ts` imports `ImportRepository` but never uses it

**File**: [data.handler.ts:13](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/data/handlers/data.handler.ts#L13)

---

### 3.4 🟡 `health.service.ts` imports `db` and `users` but `getSystemHealth()` doesn't use them

**File**: [health.service.ts:10-12](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/system/services/health.service.ts#L10-L12)

`getSystemHealth()` hardcodes `'up'` for both database and storage (lines 41-42) — these imports are only used by `getStorageLiveReadiness()`.

---

## 4. Missed Performance Gains

### 4.1 🟡 `auth.handler.ts` register/login: sequential `hashToken` calls

**Files**: [auth.handler.ts:121-122](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L121-L122), [auth.handler.ts:219-220](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L219-L220)

```typescript
const accessTokenHash = await hashToken(tokens.accessToken);
const refreshTokenHash = await hashToken(tokens.refreshToken);
```

These are independent operations and can be parallelized with `Promise.all`.

---

### 4.2 🟡 `auth.handler.ts` register: sequential phone + email uniqueness checks

**File**: [auth.handler.ts:65-78](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L65-L78)

`findByPhone` and `findByEmail` are independent DB queries that run sequentially. Could use `Promise.all` when email is provided.

---

### 4.3 🟡 `debt.handler.ts` `listDebtsHandler`: no `involvedUserId` filter when no direction

**File**: [debt.handler.ts:117-137](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/handlers/debt.handler.ts#L117-L137)

When `direction` is neither `'owed'` nor `'owing'`, the handler passes `userId` in `filterOptions` but `findMany` doesn't use a `userId` parameter — it only checks `involvedUserId`, `debtorId`, `creditorId`. The query may return wrong results or all debts.

**Fix**: Use `involvedUserId: user.id` instead of `userId: user.id`.

---

## 5. Placeholder / Stub Logic

### 5.1 🔴 `health.service.ts` `getSystemHealth()` — hardcoded `'up'`

**File**: [health.service.ts:41-42](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/system/services/health.service.ts#L41-L42)

```typescript
const databaseStatus = 'up';
const storageStatus = 'up';
```

This always returns `'healthy'` regardless of actual system state. Meanwhile, `system.service.ts` has *real* `checkDatabaseHealth()` / `checkStorageHealth()` functions.

**Fix**: Call the real functions from `system.service.ts`, or merge the two services.

---

### 5.2 🔴 `getStorageLiveReadiness` checks DB instead of storage

**File**: [health.service.ts:66](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/system/services/health.service.ts#L66)

```typescript
await db.select().from(users).limit(1); // checks DB, not storage
```

---

### 5.3 🔴 `importDataHandler` is a complete placeholder

**File**: [data.handler.ts:100-133](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/data/handlers/data.handler.ts#L100-L133)

```typescript
// Mock processing for now to satisfy the interface
imported = importData.length;
```

No actual data insertion happens. The `ImportRepository` is imported but never used.

---

### 5.4 🔴 Notification repository placeholder methods

**File**: [notification.repo.ts:84-107](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/repositories/database/notification.repo.ts#L84-L107)

`findByUserId`, `findById`, `findByIds`, `markAsRead`, `markAllAsRead`, `getUnreadCount`, and `delete` are all stubs that return empty results. The notification handlers call them but always get empty data.

---

### 5.5 🟡 `debt.service.ts` `validateStatusTransition` — maps `'completed'` but handler uses `'paid'`

**File**: [debt.service.ts:53-58](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/services/debt.service.ts#L53-L58) vs [debt.handler.ts:307](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/debts/handlers/debt.handler.ts#L307)

The valid transitions map has `confirmed → ['completed']`, but `completeDebtHandler` transitions to `'paid'`. This means the validation will always reject the transition.

---

## 6. Bad Naming

### 6.1 🟡 Handler naming inconsistency — verbs vs resources

Current naming uses `verbNounHandler` pattern (e.g., `createDebtHandler`, `getProfileHandler`) but it's not consistent:
- `markAsReadHandler` (good)
- `deleteAccountHandler` = `deleteUserHandler` (confusing alias, line 243 of user.handler.ts)
- `exportDataHandler` / `importDataHandler` (good)

**Recommendation**: Adopt namespace object pattern for each module:

```typescript
// Instead of:
export const createDebtHandler = ...
export const getDebtHandler = ...

// Use:
export const debt = {
  create: ...,
  get: ...,
  list: ...,
  update: ...,
  cancel: ...,
  confirm: ...,
  complete: ...,
  delete: ...,
}
```

Routes would then use `debt.create`, `debt.list` — much cleaner.

---

### 6.2 🟡 `generateTokens` takes `_userId` but ignores it

**File**: [auth.service.ts:90](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/services/auth.service.ts#L90)

```typescript
export function generateTokens(_userId: string): { ... }
```

The `_userId` parameter is completely unused. Either embed it in the token, or remove the parameter.

---

### 6.3 🟡 `sendPasswordReset` param named `resetLink` but receives a raw token

**File**: [auth.handler.ts:374](file:///c:/Users/lequa/Desktop/buddy-wallet/apps/api/src/modules/auth/handlers/auth.handler.ts#L374)

```typescript
await sendPasswordReset(user.email, resetToken, user.name || 'User');
```

But in `email.service.ts:129`, the parameter is named `resetLink`. The handler passes a raw token, not a URL. The email template placeholder is `RESET_LINK`. This is a logic/UX error — users should receive a URL, not a raw token.

---

## 7. Handler Decomposition — Recommended Splits

### 7.1 `auth.handler.ts` (423 lines) → Split into 3 files

| New File | Handlers | Lines |
|----------|----------|-------|
| `auth/handlers/register.handler.ts` | `registerHandler` | ~100 |
| `auth/handlers/login.handler.ts` | `loginHandler`, `refreshTokenHandler`, `logoutHandler` | ~160 |
| `auth/handlers/password.handler.ts` | `verifyEmailHandler`, `requestPasswordResetHandler`, `resetPasswordHandler` | ~110 |

The current 423-line file mixes user registration, login/session management, and email/password recovery into one file.

---

### 7.2 `user.handler.ts` (244 lines) → Split into 2 files

| New File | Handlers | Lines |
|----------|----------|-------|
| `user/handlers/profile.handler.ts` | `getProfileHandler`, `updateProfileHandler`, `changePasswordHandler` | ~100 |
| `user/handlers/admin.handler.ts` | `getUserByIdHandler`, `listUsersHandler`, `updateUserHandler`, `deleteUserHandler` | ~120 |

Admin-only handlers should be cleanly separated from self-service profile handlers.

---

### 7.3 `debt.handler.ts` (359 lines) → Split into 2 files

| New File | Handlers | Lines |
|----------|----------|-------|
| `debts/handlers/debt-crud.handler.ts` | `createDebtHandler`, `getDebtHandler`, `listDebtsHandler`, `updateDebtHandler`, `deleteDebtHandler` | ~200 |
| `debts/handlers/debt-actions.handler.ts` | `cancelDebtHandler`, `confirmDebtHandler`, `completeDebtHandler` | ~130 |

---

### 7.4 `bank.handler.ts` (217 lines) — OK as-is

This file is borderline — 6 handlers but reasonable cohesion. No split needed now.

---

## Summary of Issues by Severity

| Severity | Count | Categories |
|----------|-------|------------|
| 🔴 Critical | 8 | Duplicated crypto, stubs masking as real logic, SMTP perf, broken validation |
| 🟡 Important | 16 | Code duplication, unused code, missing types, perf opportunities |

> [!IMPORTANT]
> The highest-priority fixes are:
> 1. **Consolidate duplicated crypto/utility functions** (hashPassword, hashToken, verifyPassword, redactIdentifier) — pick one canonical location
> 2. **Fix `health.service.ts`** — it's completely fake while `system.service.ts` has real checks
> 3. **Fix `validateStatusTransition`** — `'completed'` vs `'paid'` mismatch means debt completion is broken
> 4. **Fix `listDebtsHandler`** — `userId` filter key doesn't match repo expectations
