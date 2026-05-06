# Error System Audit & Improvement Proposal

**Date:** May 4, 2026  
**Scope:** Error handling patterns across apps/api and packages/errors  
**Status:** 🔴 CRITICAL ISSUES FOUND - Architectural improvements needed

---

## Executive Summary

The current error system has **3 major architectural issues**:

1. **Hardcoded error strings** in services instead of using centralized error objects
2. **No HTTP status codes** in error definitions - handlers manually set them
3. **Complex error mapping layer** (`error-mapper.ts`) needed to translate service errors to HTTP responses

**Impact:**
- 21 hardcoded error codes across 5 service files
- 32 legacy code mappings in error-mapper.ts
- Manual status code setting in every handler

---

## Current Architecture (Problematic)

```
Service (hardcoded)        Error Mapper (translation)       Handler (manual status)
     |                            |                               |
{ code: 'INVALID_NAME' } → legacyCodeMap → BE_ERRORS.INVALID_INPUT → set.status = 400
```

### Issues with Current Flow

1. **Service returns raw strings:** `{ code: 'INVALID_NAME', error: '...' }`
2. **Mapper translates:** `'INVALID_NAME'` → `BE_ERRORS.INVALID_INPUT`
3. **Handler sets status:** Manually determines 400, 403, 404, etc.
4. **Redundant work:** Every handler repeats `set.status = X; return apiError(...)`

---

## 🔴 Critical Issue 1: Hardcoded Error Codes in Services

**Files Affected:**

| File | Hardcoded Codes | Count |
|------|-----------------|-------|
| `debt.service.ts` | `INVALID_AMOUNT`, `INVALID_CURRENCY`, `INVALID_STATUS_TRANSITION`, `DEBT_PERMISSION_DENIED` | 7 |
| `user.service.ts` | `INVALID_NAME`, `INVALID_EMAIL`, `INVALID_PASSWORD`, `SAME_PASSWORD` | 5 |
| `data.service.ts` | `INVALID_EXPORT_TYPE`, `INVALID_EXPORT_FORMAT`, `INVALID_DATE_FORMAT`, `INVALID_DATE_RANGE` | 4 |
| `bank.service.ts` | `INVALID_BANK_NAME`, `INVALID_ACCOUNT_NUMBER`, `INVALID_ACCOUNT_NAME` | 3 |
| `storage.service.ts` | `INVALID_FILE_TYPE`, `FILE_TOO_LARGE` | 2 |

**Example (Current - BAD):**
```typescript
// debt.service.ts
export function validateDebtAmount(amount: number): Result<void> {
  if (amount <= 0) return { code: 'INVALID_AMOUNT' };  // ❌ Hardcoded string
  if (amount > 999999999999) return { code: 'INVALID_AMOUNT' };
  return { data: undefined };
}

// Handler usage
const result = validateDebtAmount(amount);
if ('code' in result) {
  set.status = 400;  // ❌ Manual status
  return apiError(mapServiceError(result, BE_ERRORS.INVALID_INPUT));  // ❌ Translation needed
}
```

---

## 🔴 Critical Issue 2: Missing HTTP Status in Error Definitions

**Current Error Object Structure:**
```typescript
// packages/errors/src/be.errors.ts
export const BE_ERRORS = {
  INVALID_INPUT: { code: 'BE_118', message: 'Provide at least amount or description' },
  // ❌ No statusCode field!
}
```

**Handler Impact:**
```typescript
// Every handler manually sets status:
set.status = 400;  // ❌ Magic number
return apiError(BE_ERRORS.INVALID_INPUT);

set.status = 403;  // ❌ Magic number
return apiError(BE_ERRORS.PERMISSION_DENIED);

set.status = 404;  // ❌ Magic number
return apiError(BE_ERRORS.NOT_FOUND);
```

---

## 🔴 Critical Issue 3: Legacy Error Mapper Maintenance Burden

**File:** `apps/api/src/commons/http/error-mapper.ts`

```typescript
// 32 legacy code mappings that must be maintained!
const legacyCodeMap: Record<string, ErrorCatalogItem> = {
  INVALID_OPERATION: BE_ERRORS.INVALID_STATE,
  INVALID_PASSWORD: BE_ERRORS.INVALID_INPUT,
  INVALID_AMOUNT: BE_ERRORS.INVALID_INPUT,
  INVALID_CURRENCY: BE_ERRORS.INVALID_INPUT,
  // ... 28 more mappings
};
```

**Problem:** Every new validation error requires:
1. Adding code to service
2. Adding mapping to error-mapper.ts
3. Remembering to set correct status in handler

---

## ✅ Proposed Solution: Enhanced Error System

**📋 See detailed implementation plan: [NEW_ERROR_SYSTEM_PLAN.md](./NEW_ERROR_SYSTEM_PLAN.md)**

### New Architecture

```
Service (typed errors)     Enhanced Error (with status)     Handler (clean)
     |                              |                             |
BE_ERRORS.AMOUNT_INVALID  →  { code, message, status }  →  return apiError(error)
                                                ↑
                                    Native Response auto-sets HTTP status
```

### Phase 1: Enhanced Error Definitions with Auto-Generated Codes

**New Structure:**
```typescript
// packages/errors/src/be.errors.ts
import { defineErrors } from './factory';

export const BE_ERRORS = defineErrors('BE', 1, {
  // Validation Errors (400)
  INVALID_INPUT: { 
    message: 'Invalid input provided',
    status: 400
  },
  AMOUNT_INVALID: {
    message: 'Amount must be greater than 0 and less than 1 trillion',
    status: 400
  },
  // ... etc
});

// Auto-generated:
// BE_ERRORS.INVALID_INPUT = { code: 'BE_180', message: '...', status: 400 }
// BE_ERRORS.AMOUNT_INVALID = { code: 'BE_200', message: '...', status: 400 }

export type BeErrorCode = typeof BE_ERRORS[keyof typeof BE_ERRORS]['code'];
// = 'BE_001' | 'BE_002' | 'BE_032' | ...
```

### Phase 2: Updated apiError with Native Response

**Current:**
```typescript
export function apiError(error: ApiErrorValue, message?: string) {
  return { success: false, error: error.code, message: message ?? error.message };
}
// Handler must: set.status = 400; return apiError(...);
```

**New:**
```typescript
export function apiError(error: { code: string; message: string; status?: number }): Response {
  const status = error.status ?? 500;
  
  return new Response(
    JSON.stringify({ error: error.code, message: error.message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
  // Native Response automatically sets HTTP status - no set parameter needed!
}
```

### Phase 3: Services Return BE_ERRORS Directly

**Keep existing Result pattern** - just return BE_ERRORS instead of hardcoded strings:
```typescript
// debt.service.ts - use existing Result<T> type
import { BE_ERRORS } from '@repo/errors';
import type { Result } from '@repo/types';

export function validateDebtAmount(amount: number): Result<void> {
  if (amount <= 0 || amount > 999999999999) {
    return BE_ERRORS.AMOUNT_INVALID;  // ✅ Returns { code, message, status }
  }
  return { data: undefined };
}

// Handler - same pattern as today
const result = validateDebtAmount(amount);
if ('code' in result) {
  return apiError(result);  // ✅ result has .status property
}
// result.data is available here
```

### Phase 4: Validation Combinator Pattern

**For multiple validations - cleaner than sequential if statements:**
```typescript
// Handler with validation combinator
const validations = [
  validateExportType(type, ALLOWED_EXPORT_TYPES),
  validateExportFormat(format, ALLOWED_FORMATS),
  validateDateRange(startDate, endDate)
];

const errors = validations.filter(v => 'code' in v);
if (errors.length > 0) {
  const firstError = errors[0];
  return apiError(firstError);
}
```

### Phase 5: Update Handlers (3-4 hours)

**Before:**
```typescript
const amountValidation = validateDebtAmount(amount);
if ('code' in amountValidation) {
  set.status = 400;
  return apiError(mapServiceError(amountValidation, BE_ERRORS.INVALID_INPUT));
}
```

**After:**
```typescript
const result = validateDebtAmount(amount);
if ('code' in result) {
  return apiError(result);
}
// result.data available here
```

---

## Implementation Plan

### Phase 1: Add Auto-Generated Codes to BE_ERRORS (1-2 hours)

```typescript
// packages/errors/src/be.errors.ts
import { defineErrors } from './factory';

export const BE_ERRORS = defineErrors('BE', 1, {
  // Add auto-generated codes to all existing errors
  DB_CONNECTION: { 
    message: 'Database connection failed',
    status: 500  // Server error
  },
  AUTH_INVALID_CREDENTIALS: {
    message: 'Invalid email or password',
    status: 401  // Auth error
  },
  USER_NOT_FOUND: {
    message: 'User not found',
    status: 404  // Not found
  },
  PERMISSION_DENIED: {
    message: 'Permission denied',
    status: 403  // Forbidden
  },
  INVALID_INPUT: {
    message: 'Invalid input provided',
    status: 400  // Bad request
  },
  // ... etc
});

// Derive types
export type BeErrorCode = typeof BE_ERRORS[keyof typeof BE_ERRORS]['code'];
```

### Phase 2: Create Service-Specific Errors (2-3 hours)

Add granular errors to eliminate hardcoded strings:

```typescript
// packages/errors/src/be.errors.ts - Add new service-specific errors
import { defineErrors } from './factory';

export const BE_ERRORS = defineErrors('BE', 1, {
  // ... existing errors ...
  
  // Debt Service Errors
  AMOUNT_INVALID: {
    message: 'Amount must be greater than 0 and less than 1 trillion',
    status: 400
  },
  CURRENCY_INVALID: {
    message: 'Currency must be one of: USD, VND, EUR, GBP, JPY, CNY',
    status: 400
  },
  STATUS_TRANSITION_INVALID: {
    message: 'Invalid status transition',
    status: 400
  },
  DEBT_SELF_NOT_ALLOWED: {
    message: 'Cannot create a debt with yourself',
    status: 400
  },
  
  // User Service Errors  
  NAME_INVALID: {
    message: 'Name must be between 2 and 100 characters',
    status: 400
  },
  EMAIL_INVALID: {
    message: 'Invalid email address',
    status: 400
  },
  PASSWORD_INVALID: {
    message: 'Password must be at least 8 characters',
    status: 400
  },
  PASSWORD_SAME: {
    message: 'New password must be different from current password',
    status: 400
  },
  
  // Bank Service Errors
  BANK_NAME_INVALID: {
    message: 'Bank name must be between 2 and 100 characters',
    status: 400
  },
  ACCOUNT_NUMBER_INVALID: {
    message: 'Account number must be between 8 and 20 characters',
    status: 400
  },
  ACCOUNT_NAME_INVALID: {
    message: 'Account name must be between 2 and 100 characters',
    status: 400
  },
  
  // Data Service Errors
  EXPORT_TYPE_INVALID: {
    message: 'Export type is not valid',
    status: 400
  },
  EXPORT_FORMAT_INVALID: {
    message: 'Export format must be json or csv',
    status: 400
  },
  DATE_FORMAT_INVALID: {
    message: 'Invalid date format',
    status: 400
  },
  DATE_RANGE_INVALID: {
    message: 'Start date must be before end date',
    status: 400
  },
  
  // Storage Service Errors
  FILE_TYPE_INVALID: {
    message: 'File type is not allowed',
    status: 400
  },
  FILE_SIZE_INVALID: {
    message: 'File size exceeds the allowed limit',
    status: 400
  },
} as const;
```

### Phase 3: Refactor Services (4-5 hours)

**debt.service.ts:**
```typescript
import { BE_ERRORS } from '@repo/errors';
import type { Result } from '@repo/types';

export function validateDebtAmount(amount: number): Result<void> {
  if (amount <= 0 || amount > 999999999999) {
    return BE_ERRORS.AMOUNT_INVALID;  // ✅ Returns { code, message, status }
  }
  return { data: undefined };
}

export function validateCurrency(currency: string): Result<void> {
  const validCurrencies = ['USD', 'VND', 'EUR', 'GBP', 'JPY', 'CNY'];
  if (!validCurrencies.includes(currency.toUpperCase())) {
    return BE_ERRORS.CURRENCY_INVALID;
  }
  return { data: undefined };
}
```

### Phase 4: Validation Combinator Pattern

**For multiple validations - cleaner than sequential if statements:**
```typescript
// Handler with validation combinator
const validations = [
  validateExportType(type, ALLOWED_EXPORT_TYPES),
  validateExportFormat(format, ALLOWED_FORMATS),
  validateDateRange(startDate, endDate)
];

const errors = validations.filter(v => 'code' in v);
if (errors.length > 0) {
  const firstError = errors[0];
  return apiError(firstError);
}
```

### Phase 5: Update Handlers (3-4 hours)

**Before:**
```typescript
const amountValidation = validateDebtAmount(amount);
if ('code' in amountValidation) {
  set.status = 400;
  return apiError(mapServiceError(amountValidation, BE_ERRORS.INVALID_INPUT));
}
```

**After:**
```typescript
const result = validateDebtAmount(amount);
if ('code' in result) {
  return apiError(result);
}
// result.data available here
```

---

## Benefits Summary

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Hardcoded codes** | 21 across services | 0 | ✅ Eliminated |
| **Mapper maintenance** | 32 legacy mappings | 0 | ✅ Removed |
| **Manual status setting** | `set.status = 400` hardcoded | `set.status = result.status` | ✅ From error object |
| **Type safety** | String codes | Literal types | ✅ Compile-time checks |
| **HTTP status tracking** | Scattered | Centralized | ✅ Single source |
| **New error addition** | 3 files (service, mapper, handler) | 1 file | ✅ 3x faster |

---

## Migration Priority

### 🔴 Phase 1 - Critical (This Week)
1. Add auto-generated codes to all `BE_ERRORS` definitions
2. Update `packages/errors/src/types.ts` with optional status field
3. Extend `apiError()` parameter to accept error with status

### 🟡 Phase 2 - High Priority (Next Week)
4. Add service-specific error codes to `BE_ERRORS`
5. Refactor `debt.service.ts` and `user.service.ts`
6. Update handlers to use validation combinator pattern for multiple validations

### 🟢 Phase 3 - Medium Priority (Following Week)
7. Refactor remaining services (`data.service.ts`, `bank.service.ts`, `storage.service.ts`)
8. Remove `error-mapper.ts` once all services migrated
9. Update handlers to read status from error: `set.status = result.status ?? 400`

---

## Complete New Error System Definition

**Keep it simple - extend existing, don't replace:**

```typescript
// packages/errors/src/be.errors.ts

export const BE_ERRORS = defineErrors('BE', 1, {
  // Validation errors (400)
  INVALID_INPUT: { 
    message: 'Invalid input provided',
    status: 400
  },
  AMOUNT_INVALID: {
    message: 'Amount must be greater than 0',
    status: 400
  },
  // ... etc
});

// Auto-generated:
// BE_ERRORS.INVALID_INPUT = { code: 'BE_180', message: '...', status: 400 }
// BE_ERRORS.AMOUNT_INVALID = { code: 'BE_200', message: '...', status: 400 }

export type BeErrorCode = typeof BE_ERRORS[keyof typeof BE_ERRORS]['code'];
// = 'BE_001' | 'BE_002' | 'BE_032' | ...

// packages/errors/src/types.ts - extend existing

/**
 * Result type - same as today, just with optional status
 */
export type Result<T> =
  | { data: T }                                           // Success
  | { code: string; message?: string; status?: number }; // Error with optional status

// apps/api/src/commons/http/response.ts - extend existing

/**
 * Extended apiError - accepts error with optional status
 * Handler sets set.status separately (existing pattern)
 */
export function apiError(
  error: { code: string; message: string; status?: number }
): Response {
  const status = error.status ?? 500;
  
  return new Response(
    JSON.stringify({ error: error.code, message: error.message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
  // Native Response automatically sets HTTP status - no set parameter needed!
}

// Handler usage - same pattern as today
const result = validateDebtAmount(amount);
if ('code' in result) {
  return apiError(result);
}

// Multiple validations - combinator pattern
const validations = [
  validateExportType(type, ALLOWED_EXPORT_TYPES),
  validateExportFormat(format, ALLOWED_FORMATS)
];
const errors = validations.filter(v => 'code' in v);
if (errors.length > 0) {
  set.status = errors[0].status ?? 400;
  return apiError(errors[0]);
}
```

---

**End of Audit**
