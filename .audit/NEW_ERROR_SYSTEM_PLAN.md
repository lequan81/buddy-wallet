# New Error System Implementation Plan

**Status:** Proposed  
**Scope:** `packages/errors`, `apps/api/src/commons/http/response.ts`, all handlers  
**Goals:** DRY error definitions, auto-generated numeric codes, native Response for status handling

---

## 1. New Error Architecture

### 1.1 Factory Function

```typescript
// packages/errors/src/factory.ts
type ErrorCategory = 'BE' | 'FE' | 'GEN' | 'S3';

type ErrorInput = {
  message: string;
  status?: number;
};

export function defineErrors<const C extends ErrorCategory>(
  category: C,
  startId: number,
  errors: Record<string, ErrorInput>
) {
  let id = startId;
  const result: Record<string, { code: string; message: string; status: number }> = {};
  
  for (const [key, def] of Object.entries(errors)) {
    result[key] = {
      code: `${category}_${String(id).padStart(3, '0')}`,  // 'BE_032'
      message: def.message,
      status: def.status ?? 500,
    };
    id++;
  }
  
  return result as {
    [K in keyof typeof errors]: {
      code: `${C}_${string}`;
      message: string;
      status: number;
    };
  };
}
```

### 1.2 Error Definitions by Category

```typescript
// packages/errors/src/be.errors.ts
import { defineErrors } from './factory';

export const BE_ERRORS = defineErrors('BE', 1, {
  // Database Errors (001-009)
  DB_CONNECTION: { message: 'Database connection failed', status: 503 },
  DB_QUERY: { message: 'Database query failed', status: 500 },
  DB_INSERT: { message: 'Failed to insert record', status: 500 },
  DB_UPDATE: { message: 'Failed to update record', status: 500 },
  DB_DELETE: { message: 'Failed to delete record', status: 500 },
  
  // Auth Errors (010-029)
  AUTH_TOKEN_EXPIRED: { message: 'Authentication token expired', status: 401 },
  AUTH_TOKEN_INVALID: { message: 'Invalid authentication token', status: 401 },
  AUTH_SESSION_EXPIRED: { message: 'Session expired', status: 401 },
  AUTH_INVALID_CREDENTIALS: { message: 'Invalid email or password', status: 401 },
  AUTH_PHONE_EXISTS: { message: 'Phone number already registered', status: 409 },
  AUTH_EMAIL_EXISTS: { message: 'Email already registered', status: 409 },
  AUTH_INVALID_PHONE: { message: 'Invalid phone number format', status: 400 },
  AUTH_NO_SESSION: { message: 'No valid session', status: 401 },
  AUTH_PASSWORD_MISMATCH: { message: 'Current password is incorrect', status: 401 },
  AUTH_ACCOUNT_LOCKED: { message: 'Account is locked', status: 403 },
  AUTH_WEAK_PASSWORD: { message: 'Password is too weak', status: 400 },
  AUTH_COMMON_PASSWORD: { message: 'Password is too common', status: 400 },
  
  // User Errors (030-039)
  USER_NOT_FOUND: { message: 'User not found', status: 404 },
  USER_INACTIVE: { message: 'User account is inactive', status: 403 },
  PERMISSION_DENIED: { message: 'Permission denied', status: 403 },
  
  // Rate Limiting (040-049)
  RATE_LIMITED: { message: 'Too many requests', status: 429 },
  
  // Import/Export (050-069)
  IMPORT_PARSE_ERROR: { message: 'Failed to parse file', status: 400 },
  IMPORT_EMPTY_SHEET: { message: 'File contains no data', status: 400 },
  IMPORT_INVALID_FORMAT: { message: 'Invalid file format', status: 400 },
  IMPORT_ROW_ERROR: { message: 'Error processing row', status: 422 },
  EXPORT_FAILED: { message: 'Export generation failed', status: 500 },
  EXPORT_NO_DATA: { message: 'No data to export', status: 400 },
  
  // File Upload (070-089)
  FILE_TOO_LARGE: { message: 'File size exceeds the allowed limit', status: 413 },
  FILE_INVALID_TYPE: { message: 'File type is not allowed', status: 415 },
  FILE_UPLOAD_FAILED: { message: 'File upload failed', status: 500 },
  FILE_NOT_FOUND: { message: 'File not found', status: 404 },
  FILE_PERMISSION_DENIED: { message: 'Not authorized to access this file', status: 403 },
  
  // Debt Errors (090-109)
  DEBT_NOT_FOUND: { message: 'Debt not found', status: 404 },
  DEBT_INVALID_STATUS: { message: 'Invalid status transition', status: 400 },
  DEBT_PERMISSION_DENIED: { message: 'Not authorized to modify this debt', status: 403 },
  DEBT_PENDING_LIMIT: { message: 'Too many unconfirmed debts', status: 400 },
  DEBT_DUPLICATE_WARNING: { message: 'Potential duplicate debt found', status: 409 },
  DEBT_ALREADY_CONFIRMED: { message: 'Debt already confirmed by creator', status: 400 },
  DEBT_INVALID_STATE: { message: 'Invalid debt state for this operation', status: 400 },
  DEBT_SELF_NOT_ALLOWED: { message: 'Cannot create a debt with yourself', status: 400 },
  DEBT_PHONE_REQUIRED: { message: 'Phone number required to create debts', status: 400 },
  DEBT_INVALID_PHONE: { message: 'Invalid counterparty phone number', status: 400 },
  
  // Bank Account (110-129)
  BANK_ACCOUNT_NOT_FOUND: { message: 'Bank account not found', status: 404 },
  BANK_ACCOUNT_LIMIT: { message: 'Maximum number of bank accounts reached', status: 400 },
  BANK_ACCOUNT_DUPLICATE: { message: 'Bank account already exists', status: 409 },
  BANK_ACCOUNT_PERMISSION_DENIED: { message: 'Not authorized to manage this bank account', status: 403 },
  
  // Session (130-139)
  SESSION_NOT_FOUND: { message: 'Session not found or already revoked', status: 401 },
  SESSION_EXPIRED: { message: 'Session has expired', status: 401 },
  
  // Queue/Redis (140-149)
  QUEUE_UNAVAILABLE: { message: 'Queue not available', status: 503 },
  REDIS_UNAVAILABLE: { message: 'Redis client not ready', status: 503 },
  JOB_NOT_FOUND: { message: 'Job not found', status: 404 },
  JOB_UNAUTHORIZED: { message: 'Not authorized to cancel this job', status: 403 },
  JOB_INVALID_STATE: { message: 'Cannot cancel job in current state', status: 400 },
  
  // Push Notifications (150-159)
  PUSH_SUBSCRIPTION_FAILED: { message: 'Failed to create push subscription', status: 500 },
  PUSH_SUBSCRIPTION_NOT_FOUND: { message: 'Push subscription not found', status: 404 },
  PUSH_SEND_FAILED: { message: 'Failed to send push notification', status: 500 },
  PUSH_INVALID_SUBSCRIPTION: { message: 'Invalid push subscription data', status: 400 },
  PUSH_NOT_CONFIGURED: { message: 'Push notifications not configured', status: 503 },
  NOTIFICATION_NOT_FOUND: { message: 'Notification not found', status: 404 },
  
  // Password Reset (160-169)
  INVALID_PHONE: { message: 'Invalid phone number format', status: 400 },
  ACCOUNT_LOCKED: { message: 'Account is locked. Please contact support', status: 403 },
  INVALID_RESET_LINK: { message: 'Invalid or expired reset link', status: 400 },
  RESET_LINK_EXPIRED: { message: 'Reset link has expired', status: 400 },
  RESET_LINK_USED: { message: 'Reset link has already been used', status: 400 },
  CONCURRENT_RESET: { message: 'Reset link has already been used or expired', status: 400 },
  
  // Email Verification (170-179)
  EMAIL_OTP_EXPIRED: { message: 'Verification code has expired', status: 400 },
  EMAIL_OTP_INVALID: { message: 'Invalid verification code', status: 400 },
  EMAIL_ALREADY_VERIFIED: { message: 'Email is already verified', status: 400 },
  EMAIL_SEND_FAILED: { message: 'Failed to send verification email', status: 500 },
  EMAIL_TOO_MANY_ATTEMPTS: { message: 'Too many verification attempts', status: 429 },
  OTP_NOT_FOUND: { message: 'No pending verification found', status: 404 },
  OTP_MAX_ATTEMPTS: { message: 'Too many attempts. Please request a new OTP', status: 429 },
  
  // Input Validation (180-189)
  INVALID_INPUT: { message: 'Invalid input provided', status: 400 },
  FORBIDDEN: { message: 'Creators cannot suggest edits', status: 403 },
  INVALID_STATE: { message: 'Invalid state for this operation', status: 400 },
  NO_DEBTS: { message: 'No debts to export', status: 400 },
  
  // User Management (190-199)
  EMAIL_VERIFICATION_REQUIRED: { message: 'Email verification required to enable push notifications', status: 400 },
  USER_NO_EMAIL: { message: 'User has no email address', status: 400 },
  MISSING_TOKEN: { message: 'No refresh token provided', status: 400 },
  ACCOUNT_DEACTIVATED: { message: 'Account is deactivated', status: 403 },
  
  // Payment/File Review (200-209)
  FILE_ALREADY_REVIEWED: { message: 'File already reviewed', status: 400 },
  FILE_NO_RELATED_DEBT: { message: 'No related debt found', status: 404 },
  FILE_ACCESS_DENIED: { message: 'Access denied to file', status: 403 },
  FILE_STORAGE_ERROR: { message: 'File storage error', status: 500 },
  FILE_UNAUTHORIZED: { message: 'Not authorized to access this file', status: 403 },
  
  // Bank Operations (210-219)
  ADD_ACCOUNT_FAILED: { message: 'Failed to add bank account', status: 500 },
  UPDATE_ACCOUNT_FAILED: { message: 'Failed to update bank account', status: 500 },
  GET_ACCOUNTS_FAILED: { message: 'Failed to retrieve bank accounts', status: 500 },
} as const);

export type BeErrorCode = typeof BE_ERRORS[keyof typeof BE_ERRORS]['code'];
```

```typescript
// packages/errors/src/fe.errors.ts
import { defineErrors } from './factory';

export const FE_ERRORS = defineErrors('FE', 1, {
  // Form Errors (001-009)
  FORM_INVALID: { message: 'Form validation failed', status: 400 },
  FORM_SUBMIT_FAILED: { message: 'Form submission failed', status: 500 },
  
  // File Errors (010-019)
  FILE_NOT_SELECTED: { message: 'No file selected', status: 400 },
  FILE_TOO_LARGE: { message: 'File size exceeds limit', status: 413 },
  FILE_INVALID_TYPE: { message: 'Invalid file type', status: 415 },
  FILE_EMPTY: { message: 'File is empty', status: 400 },
  EMPTY_SHEET: { message: 'File contains no data', status: 400 },
  INVALID_FILE_FORMAT: { message: 'Invalid file format', status: 400 },
  
  // Import Errors (020-029)
  IMPORT_NO_CONFIG: { message: 'Column mapping not configured', status: 400 },
  IMPORT_MISSING_REQUIRED: { message: 'Required columns not mapped', status: 400 },
  IMPORT_PREVIEW_FAILED: { message: 'Failed to preview file', status: 500 },
  INVALID_MAPPING: { message: 'Name and Amount columns required', status: 400 },
  INCOMPLETE_MAPPING: { message: 'Incomplete mapping: Name and Amount columns are required', status: 400 },
  NO_DATA_ROWS: { message: 'No data rows found', status: 400 },
  
  // API Errors (030-039)
  API_UNREACHABLE: { message: 'Cannot connect to server', status: 503 },
  API_RESPONSE_INVALID: { message: 'Invalid response from server', status: 502 },
} as const);

export type FeErrorCode = typeof FE_ERRORS[keyof typeof FE_ERRORS]['code'];
```

```typescript
// packages/errors/src/gen.errors.ts
import { defineErrors } from './factory';

export const GEN_ERRORS = defineErrors('GEN', 1, {
  // Generic Errors (001-019)
  UNKNOWN: { message: 'An unexpected error occurred', status: 500 },
  NOT_FOUND: { message: 'Resource not found', status: 404 },
  VALIDATION: { message: 'Validation failed', status: 400 },
  UNAUTHORIZED: { message: 'Authentication required', status: 401 },
  FORBIDDEN: { message: 'Access denied', status: 403 },
  INVALID_INPUT: { message: 'Invalid input provided', status: 400 },
  SERVICE_UNAVAILABLE: { message: 'Service temporarily unavailable', status: 503 },
  TIMEOUT: { message: 'Request timed out', status: 504 },
  CONFLICT: { message: 'Resource conflict detected', status: 409 },
  RATE_LIMITED: { message: 'Too many requests', status: 429 },
  
  // Configuration Errors (020-029)
  CONFIG_MISSING: { message: 'Required configuration is missing', status: 500 },
  CONFIG_INVALID: { message: 'Invalid configuration value', status: 500 },
  
  // Network Errors (030-039)
  NETWORK_ERROR: { message: 'Network communication failed', status: 502 },
  DNS_ERROR: { message: 'DNS resolution failed', status: 502 },
  CONNECTION_TIMEOUT: { message: 'Connection timed out', status: 504 },
} as const);

export type GenErrorCode = typeof GEN_ERRORS[keyof typeof GEN_ERRORS]['code'];
```

---

## 2. Updated Response Functions (Native Response)

### 2.1 apiError with Native Response

```typescript
// apps/api/src/commons/http/response.ts
import { logger } from '@repo/logger';

export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

export interface ApiResponse<T = unknown> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Return error response with status from error object
 * Uses native Response to auto-set HTTP status without manual set.status
 */
export function apiError(error: ApiError, details?: string): Response {
  const status = error.status ?? 500;
  
  // Log error for observability
  if (status >= 500) {
    logger.error('API Error', { code: error.code, status, message: error.message });
  }
  
  return new Response(
    JSON.stringify({
      error: error.code,
      message: error.message,
      ...(details && { details })
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}

/**
 * Return success response
 */
export function apiSuccess<T>(data: T, meta?: ApiResponse<T>['meta']): Response {
  return new Response(
    JSON.stringify({
      data,
      ...(meta && { meta })
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Return created response
 */
export function apiCreated<T>(data: T): Response {
  return new Response(
    JSON.stringify({ data }),
    {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Return no content response
 */
export function apiNoContent(): Response {
  return new Response(null, { status: 204 });
}
```

---

## 3. Handler Usage Examples

### 3.1 Before (Current Messy Pattern)

```typescript
// Current - requires manual set.status, repetitive
.post('/debts', async ({ body, set }) => {
  const amountValidation = validateDebtAmount(body.amount);
  if (amountValidation.error) {
    set.status = 400;  // ❌ Manual, error-prone
    return apiError(mapServiceError(amountValidation));
  }
  
  const phoneValidation = validatePhonePair(body.creditorPhone, body.debtorPhone);
  if (phoneValidation.error) {
    set.status = 400;  // ❌ Repetitive
    return apiError(mapServiceError(phoneValidation));
  }
  
  // ... handler logic
}, {
  body: 'debt.create'
});
```

### 3.2 After (Clean Pattern with Native Response)

```typescript
// After - clean, no set parameter, no manual status
.post('/debts', async ({ body }) => {
  // Single validation with early return
  const amountValidation = validateDebtAmount(body.amount);
  if (amountValidation.error) {
    return apiError(amountValidation.error);  // ✅ Status from error
  }
  
  const phoneValidation = validatePhonePair(body.creditorPhone, body.debtorPhone);
  if (phoneValidation.error) {
    return apiError(phoneValidation.error);  // ✅ Status from error
  }
  
  // Create debt
  const debt = await debtRepo.create(body);
  return apiCreated(debt);
}, {
  body: 'debt.create'
});
```

### 3.3 Validation Combinator Pattern (Multiple Validations)

```typescript
// apps/api/src/commons/validation/combinators.ts
import { BE_ERRORS } from '@repo/errors';

export type ValidationResult = 
  | { valid: true }
  | { valid: false; error: typeof BE_ERRORS[keyof typeof BE_ERRORS] };

export function combineValidations(
  ...validations: ValidationResult[]
): ValidationResult {
  const firstError = validations.find((v): v is { valid: false; error: typeof BE_ERRORS[keyof typeof BE_ERRORS] } => !v.valid);
  
  if (firstError) {
    return firstError;
  }
  
  return { valid: true };
}

// Usage in handler
.post('/debts', async ({ body }) => {
  const validation = combineValidations(
    validateDebtAmount(body.amount),
    validateCurrency(body.currency),
    validatePhonePair(body.creditorPhone, body.debtorPhone)
  );
  
  if (!validation.valid) {
    return apiError(validation.error);  // ✅ Returns first error with correct status
  }
  
  const debt = await debtRepo.create(body);
  return apiCreated(debt);
});
```

---

## 4. Migration Plan

### Phase 1: Create New Error System (Day 1)

1. Create `packages/errors/src/factory.ts`
2. Rewrite `packages/errors/src/be.errors.ts` using `defineErrors`
3. Rewrite `packages/errors/src/fe.errors.ts` using `defineErrors`
4. Rewrite `packages/errors/src/gen.errors.ts` using `defineErrors`
5. Update `packages/errors/src/index.ts` exports
6. Update `packages/errors/src/types.ts` to remove legacy types

### Phase 2: Update Response Functions (Day 1-2)

1. Rewrite `apps/api/src/commons/http/response.ts`:
   - `apiError()` returns native `Response`
   - `apiSuccess()` returns native `Response`
   - `apiCreated()` returns native `Response`
   - `apiNoContent()` returns native `Response`
2. Remove `mapServiceError()` from `error-mapper.ts`
3. Update global error handler in `bootstrap.ts` to return Response

### Phase 3: Migrate Handlers (Day 2-3)

1. Update auth handlers to use new pattern
2. Update debt handlers to use new pattern
3. Update user handlers to use new pattern
4. Update bank handlers to use new pattern
5. Update storage handlers to use new pattern
6. Update data handlers to use new pattern

### Phase 4: Clean Up (Day 3)

1. Remove `error-mapper.ts`
2. Remove legacy error type definitions
3. Update tests
4. Verify all handlers compile

---

## 5. Benefits Summary

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Error definition** | 4 properties (key, code, id, message, status) | 2 properties (message, status) | ✅ DRY, 50% less code |
| **Code generation** | Manual string (error-prone) | Auto-generated numeric | ✅ Never out of sync |
| **Status handling** | Manual `set.status` in every handler | Native Response auto-set | ✅ Zero manual status |
| **Handler signature** | `({ body, set })` | `({ body })` | ✅ No set parameter |
| **Type safety** | String codes | Literal union types | ✅ Compile-time checks |
| **Testability** | Requires mock set | Pure functions | ✅ Easier testing |
| **Bundle size** | Larger (set manipulation) | Smaller (native Response) | ✅ Smaller bundle |
| **Performance** | Extra set operations | Native Response | ✅ Faster |

---

## 6. Files to Modify

### packages/errors
- `src/factory.ts` (NEW)
- `src/be.errors.ts` (REWRITE)
- `src/fe.errors.ts` (REWRITE)
- `src/gen.errors.ts` (REWRITE)
- `src/index.ts` (UPDATE exports)
- `src/types.ts` (SIMPLIFY)

### apps/api
- `src/commons/http/response.ts` (REWRITE with native Response)
- `src/commons/http/error-mapper.ts` (DELETE)
- `src/bootstrap.ts` (UPDATE global error handler)
- `src/modules/auth/handlers/*.ts` (UPDATE)
- `src/modules/debts/handlers/*.ts` (UPDATE)
- `src/modules/user/handlers/*.ts` (UPDATE)
- `src/modules/bank/handlers/*.ts` (UPDATE)
- `src/modules/storage/handlers/*.ts` (UPDATE)
- `src/modules/data/handlers/*.ts` (UPDATE)
