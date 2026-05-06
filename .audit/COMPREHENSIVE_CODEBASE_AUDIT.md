# Buddy Wallet: Comprehensive Codebase Audit

**Date:** May 2026  
**Scope:** TypeBox Migration, Schema Consolidation, try-catch Patterns, Magic Numbers, SSE Removal  
**Status:** 🔴 CRITICAL ISSUES IDENTIFIED

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [TypeBox Migration (Valibot Removal)](#1-typebox-migration-valibot-removal)
3. [Schema Architecture Consolidation](#2-schema-architecture-consolidation)
4. [Database Schema Updates](#3-database-schema-updates)
5. [try-catch Pattern Violations](#4-try-catch-pattern-violations)
6. [Magic Numbers Audit](#5-magic-numbers-audit)
7. [SSE to XHR Migration](#6-sse-to-xhr-migration)
8. [Advanced TypeScript Patterns](#7-advanced-typescript-patterns)
9. [Schema Ownership Rules](#8-schema-ownership-rules)
10. [JSON Storage Size Analysis](#9-json-storage-size-analysis-critical)
11. [SafeUser → UserResponse Rename](#10-safeuser--userresponse-rename-type-naming-alignment)
12. [Implementation Roadmap](#11-implementation-roadmap)

---

## Executive Summary

| Category | Status | Priority |
|----------|--------|----------|
| TypeBox Migration | 🔴 INCOMPLETE | P0 |
| Schema Consolidation | 🔴 FRAGMENTED | P0 |
| Database Schema (drizzle-valibot) | 🔴 DEPENDENCY LOCK | P0 |
| try-catch Patterns | 🟡 VIOLATIONS FOUND | P1 |
| Magic Numbers | 🟡 PARTIALLY CENTRALIZED | P2 |
| SSE to XHR | 🔴 CRITICAL GAPS | P0 |
| SafeUser Rename | 🟡 NAMING INCONSISTENCY | P2 |
| JSON Size Limits | 🔴 NO LIMITS SET | P1 |

**Key Findings:**
1. **Dual schema libraries**: TypeBox in `apps/api`, Valibot in `packages/validation` + `packages/db`
2. **drizzle-valibot locks DB to Valibot** — must decouple
3. **packages/schema exists but is underutilized** — uses Valibot instead of TypeBox
4. **Missing `progress-batch` endpoint** — frontend fallback is broken
5. **try-catch used for validation** — violates "exceptions for exceptional cases" principle
6. **`SafeUser` naming is ambiguous** — should be `UserResponse` for clarity
7. **JSON preview storage has no size limits** — 10,000 rows = 50-100MB unbounded

---

## 1. TypeBox Migration (Valibot Removal)

### Current State

| Package | Library | Issue |
|---------|---------|-------|
| `apps/api` | TypeBox ✅ | Correct, via Elysia |
| `apps/api` repos | TypeBox ✅ | Uses `TypeCompiler` |
| `packages/validation` | **Valibot** ❌ | **Must migrate** |
| `packages/db` | **Valibot** ❌ | **Must decouple** |
| `packages/schema` | **Valibot** ❌ | **Must migrate to TypeBox** |

### Evidence

```typescript
// packages/validation/src/auth.ts - VALIBOT (to be removed)
import * as v from 'valibot';
export const passwordSchema = v.pipe(
  v.string(),
  v.minLength(8, 'Password must be at least 8 characters')
);

// apps/api/src/modules/auth/schema.ts - TYPEBOX (correct)
import { t } from 'elysia';
export const LoginSchema = t.Object({
  identifier: t.String({ minLength: 1 }),
  password: t.String({ minLength: 8 })
});

// packages/db/src/schema/user.schema.ts - VALIBOT via drizzle-valibot
import { createInsertSchema } from 'drizzle-valibot';
import * as v from 'valibot';
export const insertUserSchema = v.omit(createInsertSchema(users, {...}), [...]);
```

### Migration Strategy

**Step 1: Remove `drizzle-valibot` from `packages/db`**

```typescript
// BEFORE (packages/db/src/schema/user.schema.ts)
import { createInsertSchema } from 'drizzle-valibot';
import * as v from 'valibot';
export const insertUserSchema = v.omit(createInsertSchema(users, {...}), [...]);

// AFTER (pure Drizzle types, validation moves to API layer)
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
// NO validation schema here — pure data layer
```

**Step 2: Consolidate all validation to `packages/schema` using TypeBox**

```typescript
// packages/schema/src/shared/auth/login.schema.ts
import { t, Static } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

export const LoginSchema = t.Object({
  identifier: t.String({ minLength: 1 }),
  password: t.String({ minLength: 8, maxLength: 128 })
});

export type LoginInput = Static<typeof LoginSchema>;
export const LoginValidator = TypeCompiler.Compile(LoginSchema);
```

**Step 3: Update imports across codebase**

```typescript
// BEFORE
import { loginSchema } from '@repo/validation';

// AFTER  
import { LoginSchema } from '@repo/schema/shared/auth';
```

### Files to Modify

| File | Action | Priority |
|------|--------|----------|
| `packages/db/src/schema/*.ts` | Remove `drizzle-valibot`, keep pure types | P0 |
| `packages/validation/` | **Delete entire package** | P0 |
| `packages/schema/src/shared/common.schema.ts` | Rewrite in TypeBox | P0 |
| `packages/schema/src/` | Create TypeBox schemas mirroring validation | P0 |
| `apps/api/src/modules/*/schema.ts` | Migrate to `@repo/schema` | P1 |
| `apps/web/src/lib/validation/` | Update imports to `@repo/schema` | P1 |

---

## 2. Schema Architecture Consolidation

### Current Fragmentation

```
packages/
├── validation/          ← Valibot schemas (duplicates schema)
│   ├── src/auth.ts
│   ├── src/debt.ts
│   └── index.ts
├── schema/              ← Underutilized, uses Valibot
│   ├── src/shared/
│   │   └── common.schema.ts  (Valibot!)
│   └── src/env/
└── db/                  ← Drizzle ORM + drizzle-valibot
    └── src/schema/
        ├── user.schema.ts
        └── debt.schema.ts
```

### Target Architecture

```
packages/
├── schema/              ← Single source of truth (TypeBox)
│   ├── src/
│   │   ├── shared/        ← API/shared DTOs shared
│   │   │   ├── auth/
│   │   │   ├── debt/
│   │   │   ├── import/
│   │   │   └── common.ts
│   │   ├── db/         ← Drizzle table definitions (pure)
│   │   │   ├── tables/
│   │   │   └── relations/
│   │   └── entities/   ← Domain types (frontend + backend)
│   └── package.json    ← Exports: shared, db, entities
```

### Package Exports Design

```json
// packages/schema/package.json
{
  "exports": {
    "./shared": "./src/shared/index.ts",
    "./shared/auth": "./src/shared/auth/index.ts",
    "./db": "./src/db/index.ts",
    "./entities": "./src/entities/index.ts",
    "./types": "./src/types/index.ts"
  }
}
```

### Usage Patterns

```typescript
// Backend API — DTO validation via Elysia
import { LoginSchema } from '@repo/schema/shared/auth';
.post('/login', handler, { body: LoginSchema })

// Backend Repository — Entity types
import { User, NewUser } from '@repo/schema/db';
async function createUser(data: NewUser): Promise<User>

// Frontend — Runtime validation via TypeCompiler
import { LoginValidator, LoginInput } from '@repo/schema/shared/auth';
const isValid = LoginValidator.Check(formData);
```

---

## 3. Database Schema Updates

### Issue: drizzle-valibot Coupling

```typescript
// packages/db/src/schema/debt.schema.ts
import { createInsertSchema } from 'drizzle-valibot';  // ❌ REMOVE
import * as v from 'valibot';                           // ❌ REMOVE

export const insertDebtSchema = v.omit(
  createInsertSchema(debts, {...}),  // ❌ Runtime dependency on Valibot
  ['id', 'createdAt', 'updatedAt']
);
```

### Solution: Pure Drizzle + TypeBox Validation Layer

**Database Layer (Pure Drizzle):**
```typescript
// packages/db/src/schema/debt.schema.ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
// NO valibot imports

export const debts = sqliteTable('debts', {
  id: text('id', { length: 24 }).primaryKey(),
  // ... column definitions
});

// Only export types
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
// NO insert schemas here
```

**Validation Layer (TypeBox):**
```typescript
// packages/schema/src/shared/debt/create-debt.schema.ts
import { t, Static } from '@sinclair/typebox';

export const CreateDebtSchema = t.Object({
  debtorPhone: t.String({ minLength: 1 }),
  creditorPhone: t.String({ minLength: 1 }),
  amount: t.Number({ minimum: 1 }),
  currency: t.String({ length: 3 }),
  description: t.Optional(t.String())
});

export type CreateDebtInput = Static<typeof CreateDebtSchema>;
```

### Migration Checklist

| Schema File | Remove drizzle-valibot | Keep Drizzle Types | Create TypeBox DTO |
|-------------|------------------------|--------------------|--------------------|
| `user.schema.ts` | ✅ | ✅ | P0 |
| `debt.schema.ts` | ✅ | ✅ | P0 |
| `session.schema.ts` | ✅ | ✅ | P1 |
| `import-log.schema.ts` | ✅ | ✅ | P1 |
| `bank-account.schema.ts` | ✅ | ✅ | P1 |
| All others | ✅ | ✅ | P2 |

---

## 4. try-catch Pattern Violations

### Principle

> **try-catch is ONLY for exceptional, unrecoverable errors (I/O, network, external services).**  
> **Validation uses if-else or Result types.**  
> **Catch only what you can resolve; otherwise propagate up.**

### Violation Patterns Found

#### ❌ Pattern 1: try-catch for Validation

**Location:** `apps/api/src/modules/data/handlers/preview.handler.ts:52-57`

```typescript
// WRONG: Using try-catch for validation
let parsed;
try {
  parsed = await parseSpreadsheetFile(buffer, file.name);
} catch (err) {
  set.status = 400;
  return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, ...);
}
```

**Fix:**
```typescript
// CORRECT: Result type for validation
const result = await parseSpreadsheetFile(buffer, file.name);
if ('code' in result) {
  return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, result.message);
}
const parsed = result.data;
```

#### ❌ Pattern 2: Silent Error Swallowing

**Location:** `apps/api/src/modules/storage/services/s3.service.ts:66-73`

```typescript
// WRONG: Catching but not propagating
async delete(relativePath: string): Promise<void> {
  const key = toKey(relativePath);
  try {
    await s3Client.delete(key);
  } catch (error) {
    logger.warn('Failed to delete', { key, error });  // ❌ Silent!
    // Missing: throw or return error
  }
}
```

**Fix:**
```typescript
// CORRECT: Either propagate or return error
async delete(relativePath: string): Promise<Result<void>> {
  const key = toKey(relativePath);
  try {
    await s3Client.delete(key);
    return { data: undefined };
  } catch (error) {
    logger.error('S3 delete failed', { key, error });
    return { 
      code: 'STORAGE_DELETE_FAILED', 
      message: `Failed to delete ${key}`,
      cause: error 
    };
  }
}
```

#### ❌ Pattern 3: Generic catch Without Context

**Location:** Multiple files

```typescript
// WRONG: Generic catch, no context
try {
  await someOperation();
} catch (err) {
  logger.error('Error', err);  // ❌ No business context
  throw err;  // ❌ Re-throwing same error
}
```

**Fix:**
```typescript
// CORRECT: Wrap with business context
try {
  await someOperation();
} catch (error) {
  logger.error('Debt confirmation failed during transaction', {
    debtId,
    userId,
    error
  });
  throw new DebtConfirmationError(
    'Failed to confirm debt', 
    { debtId, cause: error }
  );
}
```

### Exception Hierarchy to Implement

```typescript
// packages/errors/src/hierarchy.ts
export abstract class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class StorageError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', 500);
    Object.assign(this, meta);
  }
}

export class BusinessError extends AppError {
  constructor(
    code: string, 
    message: string, 
    statusCode: number = 400,
    meta?: Record<string, unknown>
  ) {
    super(message, code, statusCode);
    Object.assign(this, meta);
  }
}
```

---

## 5. Magic Numbers Audit

### Centralized Constants (✅ GOOD)

**Location:** `packages/config/src/shared/index.ts`

```typescript
export const SHARED_CONSTANTS = {
  IMPORT: {
    MAX_ROWS: 10000,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    CHUNK_SIZE: 200,
    PREVIEW_ROWS: 5,
  },
  DEBT: {
    MIN_AMOUNT: 1000,
    MAX_AMOUNT: 1000000000000,
    MAX_BATCH_DELETE: 50,
  },
  AUTH: {
    OTP_EXPIRY_MINUTES: 10,
    OTP_MAX_ATTEMPTS: 5,
    SESSION_MAX_AGE_SECONDS: 15 * 60,
  }
};
```

### Scattered Magic Numbers (❌ TO FIX)

| File | Line | Magic Number | Should Use |
|------|------|--------------|------------|
| `preview.handler.ts` | 102 | `generatePreviewRows(parsed.rows, 10)` | `SHARED_CONSTANTS.IMPORT.PREVIEW_ROWS` |
| `login.handler.ts` | 26 | `90 * 24 * 60 * 60` | `SHARED_CONSTANTS.AUTH.REFRESH_TOKEN_MAX_AGE_SECONDS` |
| `login.handler.ts` | 71 | `900` (TTL) | `TIMEOUTS.OTP_TTL_SECONDS` |
| `login.handler.ts` | 75 | `15 * 60 * 1000` | `SHARED_CONSTANTS.AUTH.LOCKOUT_DURATION_MS` |
| `import.handler.ts` | 40 | `10_000` | `SHARED_CONSTANTS.IMPORT.MAX_ROWS` |
| `create.handler.ts` | 10 | `MAX_PENDING_DEBTS = 10` | But 10 ≠ 200 in config! |

### Critical Inconsistency Found

```typescript
// apps/api/src/modules/debts/handlers/create.handler.ts:10
const MAX_PENDING_DEBTS = 10;  // ❌ Local constant

// packages/config/src/shared/index.ts:48
MAX_PENDING_DEBTS: 200,  // ❌ Config says 200!
```

**Fix:** Remove local constant, use centralized:
```typescript
import { SHARED_CONSTANTS } from '@repo/config';
const { MAX_PENDING_DEBTS } = SHARED_CONSTANTS.USER;  // 200
```

---

## 6. SSE to XHR Migration

### Critical Gap: Missing Endpoint

**Frontend calls:** `api.v1.import['progress-batch'].post()`  
**Backend has:** NO SUCH ENDPOINT

**Fix:** Create `POST /data/import/progress-poll`

### Migration Checklist

| Task | File | Action |
|------|------|--------|
| Delete SSE handler | `sse.handler.ts` | **DELETE** |
| Remove SSE route | `routes.ts` | Remove lines 46-49 |
| Create XHR endpoint | `progress-poll.handler.ts` | **CREATE** |
| Rewrite frontend | `import-progress.svelte.ts` | Remove EventSource |

### XHR Endpoint Design

```typescript
// POST /data/import/progress-poll
interface Request {
  logIds: string[];  // Max 20
}

interface Response {
  data: {
    [logId: string]: {
      status: 'queued' | 'processing' | 'success' | 'failed';
      current: number;
      total: number;
      percentage: number;
    }
  };
  meta: {
    hasActiveJobs: boolean;  // Client stops polling if false
    serverTime: string;
  }
}
```

---

## 7. Advanced TypeScript Patterns (Currently Missing)

### 7.1 typeof & keyof for Type Generation

**Current Issue:** Hard-coded string unions instead of deriving from source

```typescript
// BEFORE (manual, error-prone)
export type ImportStatus = 'pending' | 'queued' | 'processing' | 'success' | 'failed';

// AFTER (derived from source of truth)
import { importLogs } from '@repo/db';

// Derive from Drizzle table definition
export type ImportStatus = typeof importLogs.status.enumValues[number];
// OR from config
export type ImportFileExtension = typeof SHARED_CONSTANTS.IMPORT.ACCEPTED_EXTENSIONS[number];
// '.xlsx' | '.xls' | '.csv'

// keyof for field name generation
type ImportLogField = keyof typeof importLogs.$inferSelect;
// 'id' | 'userId' | 'fileName' | 'status' | ...
```

### 7.2 Template Literal Types for Auto-Generated Strings

```typescript
// Redis key patterns - enforced at type level
type RedisKeyPattern = 
  | `bw:queue:${string}`
  | `bw:job:${string}`
  | `bw:progress:${string}`
  | `bw:session:${string}`
  | `login:attempts:${string}`;

// Usage - must match pattern
const jobKey: RedisKeyPattern = `bw:job:${jobId}`;  // ✅ Valid
const badKey: RedisKeyPattern = `invalid:${jobId}`; // ❌ Type error

// Event name patterns
type ImportEventName = 
  | `import:${string}:progress`
  | `import:${string}:complete`
  | `import:${string}:error`;

function emitEvent(event: ImportEventName, data: unknown) { ... }
emitEvent(`import:${logId}:progress`, data);  // ✅
emitEvent('random-event', data);              // ❌
```

### 7.3 satisfies Operator (Type-Safe Configuration)

```typescript
// BEFORE - no excess property checking
const IMPORT_CONFIG = {
  MAX_ROWS: 10000,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  INVALID_KEY: 'oops'  // ❌ No error, silently ignored
};

// AFTER - strict checking with satisfies
const IMPORT_CONFIG = {
  MAX_ROWS: 10000,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ACCEPTED_TYPES: ['xlsx', 'csv'] as const
} satisfies {
  MAX_ROWS: number;
  MAX_FILE_SIZE: number;
  ACCEPTED_TYPES: readonly string[];
};

// Can still infer specific literal types
IMPORT_CONFIG.ACCEPTED_TYPES[0];  // 'xlsx' | 'csv', not string
```

### 7.4 Discriminated Unions for Result Types

```typescript
// BEFORE - ambiguous result type
type Result<T> = 
  | { data: T; code?: never; error?: never }
  | { code: string; error: string; data?: never };

// AFTER - discriminated union with kind
type Result<T, E = string> = 
  | { kind: 'success'; data: T }
  | { kind: 'error'; code: E; message: string; cause?: unknown }
  | { kind: 'validation'; field: string; issues: string[] };

// Usage - exhaustive switch
function handleResult<T>(result: Result<T>): T {
  switch (result.kind) {
    case 'success': return result.data;
    case 'error': throw new BusinessError(result.code, result.message);
    case 'validation': throw new ValidationError(result.issues);
    default: return assertNever(result);  // Compile-time exhaustive check
  }
}

// Helper for exhaustive checks
function assertNever(x: never): never {
  throw new Error(`Unexpected case: ${x}`);
}
```

### 7.5 Factory Closures (Replace Class-based Services)

```typescript
// BEFORE - class with DI complexity
class DebtService {
  constructor(
    private debtRepo: DebtRepository,
    private userRepo: UserRepository,
    private cache: Cache
  ) {}
  
  async create(data: CreateDebtInput) { ... }
}

// AFTER - factory closure, same deps, pure functions
export function createDebtService(
  debtRepo: DebtRepository,
  userRepo: UserRepository,
  cache: Cache
) {
  // Return object of pure functions with deps in closure
  return {
    async create(data: CreateDebtInput): Promise<Result<Debt>> {
      // Access deps via closure, not `this`
      const user = await userRepo.findById(data.debtorId);
      if (!user) return { kind: 'error', code: 'USER_NOT_FOUND', message: '...' };
      
      return debtRepo.create(data);
    },
    
    async validateStatusTransition(from: Status, to: Status): Promise<Result<void>> {
      // Same pattern - deps in closure
      const cached = await cache.get(`transition:${from}:${to}`);
      // ...
    }
  };
}

// Usage
const debtService = createDebtService(debtRepo, userRepo, cache);
const result = await debtService.create(data);
```

**Benefits:**
- No `this` binding issues
- True private state (closure scope)
- Easier to test (just pass mocks)
- No `new` keyword complexity

### 7.6 Runtime Arrays with Type Safety

```typescript
// BEFORE - any[], loses type safety
const VALID_STATUSES = ['pending', 'confirmed', 'paid', 'cancelled'];
// string[] - lost literal types

// AFTER - readonly const assertion
type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';

const VALID_STATUSES = ['pending', 'confirmed', 'paid', 'cancelled'] as const satisfies readonly DebtStatus[];
// ^(readonly ['pending', 'confirmed', 'paid', 'cancelled'])

// Can use at runtime AND type level
function isValidStatus(s: string): s is DebtStatus {
  return VALID_STATUSES.includes(s as DebtStatus);
}

// Derived types from array
type ValidStatus = typeof VALID_STATUSES[number];
// 'pending' | 'confirmed' | 'paid' | 'cancelled'
```

---

## 8. Schema Ownership Rules (Strict)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SCHEMA PLACEMENT DECISION TREE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    YES    ┌─────────────────────────────────────┐    │
│  │ 2+ apps need?   │──────────▶│          @repo/schema/*           │    │
│  └─────────────────┘           │   (shared package, versioned)     │    │
│           │ NO                 └─────────────────────────────────────┘    │
│           ▼                                                             │
│  ┌─────────────────┐    YES    ┌─────────────────────────────────────┐    │
│  │ API + Web need? │──────────▶│   @repo/schema/shared/*           │    │
│  └─────────────────┘           │   (DTOs, entities, validators)      │    │
│           │ NO                 └─────────────────────────────────────┘    │
│           ▼                                                             │
│  ┌─────────────────┐    YES    ┌─────────────────────────────────────┐    │
│  │ API internal?    │──────────▶│   apps/api/src/types/               │    │
│  └─────────────────┘           │   (route-specific, local types)     │    │
│           │ NO                 └─────────────────────────────────────┘    │
│           ▼                                                             │
│  ┌─────────────────┐    YES    ┌─────────────────────────────────────┐    │
│  │ Web internal?    │──────────▶│   apps/web/src/lib/types/         │    │
│  └─────────────────┘           │   (component-specific types)        │    │
│                                └─────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Rule 1: @repo/schema/* (2+ Apps)

**Contents:**
- Database table definitions (Drizzle)
- Shared DTOs (TypeBox)
- Domain entity types
- Common enums/constants

**Examples:**
```typescript
// @repo/schema/src/db/tables/debt.ts
export const debts = sqliteTable('debts', { ... });
export type Debt = typeof debts.$inferSelect;

// @repo/schema/src/shared/debt/create-debt.shared.ts
export const CreateDebtSchema = t.Object({ ... });
export type CreateDebtInput = Static<typeof CreateDebtSchema>;
```

**Usage:**
```typescript
import { debts, type Debt } from '@repo/schema/db';
import { CreateDebtSchema } from '@repo/schema/shared/debt';
```

### Rule 2: apps/api/src/types/ (API Internal)

**Contents:**
- Handler context types
- Route-specific request/response types
- Internal service types

**Examples:**
```typescript
// apps/api/src/modules/debts/types/handler.types.d.ts
type CreateDebtContext = Context<{
  body: CreateDebtInput;  // From @repo/schema
  user: AuthenticatedUser;
}>;

// Route-specific response types
type DebtListResponse = PaginatedResult<Debt> & { 
  filters: { status?: DebtStatus } 
};
```

### Rule 3: apps/web/src/lib/types/ (Web Internal)

**Contents:**
- Component prop types
- Store state types
- Page-specific types

**Examples:**
```typescript
// apps/web/src/lib/types/debt-list.types.ts
type DebtListView = 'table' | 'grid' | 'kanban';

interface DebtListStore {
  view: DebtListView;
  selectedIds: Set<string>;
}
```

---

## 9. JSON Storage Size Analysis (CRITICAL)

### Current Implementation

**File:** `apps/api/src/modules/data/handlers/preview.handler.ts:68-76`

```typescript
await importStorage.save(s3Key, Buffer.from(JSON.stringify({
  headers: parsed.headers,        // 3-4 columns = 3-4 strings
  rows: parsed.rows,              // 200-500 rows × 3-4 objects
  totalRows: parsed.totalRows,
  fileName: file.name,
  fileSize: file.size,
  parsedAt: new Date().toISOString()
})));
```

### Size Calculation

| Scenario | Columns | Rows | Est. JSON Size | With UTF-8 Data |
|----------|---------|------|----------------|-----------------|
| Small | 3 | 200 | ~150-250 KB | ~500 KB |
| Medium | 4 | 300 | ~300-500 KB | ~1 MB |
| Large | 4 | 500 | ~500-800 KB | ~2-3 MB |
| MAX | 4 | 10,000 (limit) | ~10-15 MB | ~50 MB |

### Current Limits

```typescript
// packages/config/src/shared/index.ts:14-16
IMPORT: {
  MAX_ROWS: 10000,              // Hard limit
  MAX_FILE_SIZE: 5 * 1024 * 1024,  // 5MB (Excel file)
  MAX_SYNC_PROCESS_SIZE: 200 * 1024,  // 200KB
}
```

### 🔴 CRITICAL GAP IDENTIFIED

**Issue:** S3 JSON storage has **no size limit** for parsed data.

- Excel file: 5MB max ✅
- Parsed JSON: **unbounded** ❌
- 10,000 rows × 10 columns = **50-100MB JSON** ❌

### Recommended Solutions

**Option A: Row Limit Only (Simple)**
```typescript
// preview.handler.ts
if (parsed.totalRows > 1000) {
  // Don't store full JSON, only preview rows
  await importStorage.save(s3Key, Buffer.from(JSON.stringify({
    headers: parsed.headers,
    rows: parsed.rows.slice(0, 100),  // Only store preview
    totalRows: parsed.totalRows,
    hasMore: parsed.totalRows > 100,
    // ...
  })));
}
```

**Option B: Chunked Storage (Scalable)**
```typescript
// Store in chunks of 1000 rows each
const CHUNK_SIZE = 1000;
const chunks = Math.ceil(parsed.rows.length / CHUNK_SIZE);

for (let i = 0; i < chunks; i++) {
  const chunkKey = `${previewId}/chunk-${i}.json`;
  const chunk = parsed.rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  await importStorage.save(chunkKey, Buffer.from(JSON.stringify(chunk)));
}

// Store manifest
await importStorage.save(`${previewId}/manifest.json`, JSON.stringify({
  headers: parsed.headers,
  totalRows: parsed.totalRows,
  chunks,
  chunkSize: CHUNK_SIZE
}));
```

**Option C: Streaming Processing (Best)**
```typescript
// Don't store full JSON at all
// Stream directly from parsed data to processing
// Only keep column mapping in S3 (tiny)
```

### Recommended Immediate Fix

Add JSON size limit to preview handler:

```typescript
// preview.handler.ts
const MAX_PREVIEW_JSON_SIZE = 10 * 1024 * 1024;  // 10MB

const jsonBuffer = Buffer.from(JSON.stringify({
  headers: parsed.headers,
  rows: parsed.rows,
  // ...
}));

if (jsonBuffer.length > MAX_PREVIEW_JSON_SIZE) {
  set.status = 413;  // Payload Too Large
  return apiError(BE_ERRORS.IMPORT_FILE_TOO_LARGE, 
    `Parsed data too large (${(jsonBuffer.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB. Consider splitting the file.`
  );
}

await importStorage.save(s3Key, jsonBuffer);
```

---

## 10. SafeUser → UserResponse Rename (Type Naming Alignment)

### Problem

`SafeUser` is ambiguous and doesn't align with the naming convention used elsewhere in the codebase:

| Current Name | Issue | Better Alternative |
|--------------|-------|-------------------|
| `SafeUser` | "Safe" is vague — safe from what? For whom? | `UserResponse` |
| `UserEntity` | ✅ Clear — database entity | Keep |
| `CurrentUser` | ✅ Clear — context user | Keep |

### Why `UserResponse` is Better

```typescript
// BEFORE (ambiguous)
export interface SafeUser extends Omit<
  UserEntity,
  'password' | 'temporaryPassword' | 'temporaryPasswordExpires' |
  'isLocked' | 'lockoutUntil' | 'failedLoginAttempts' | 'lastFailedLoginAt'
> {
  permissions: string[];
}

// AFTER (clear purpose)
export interface UserResponse extends Omit<
  UserEntity,
  'password' | 'temporaryPassword' | 'temporaryPasswordExpires' |
  'isLocked' | 'lockoutUntil' | 'failedLoginAttempts' | 'lastFailedLoginAt'
> {
  permissions: string[];
}
```

**Benefits:**
- **Self-documenting**: "This is the user data returned in API responses"
- **Aligns with `ApiResponse<T>`**: `UserResponse` is what goes inside `data: T`
- **Clear contrast**: `UserEntity` (internal) vs `UserResponse` (external)
- **Follows convention**: `XxxResponse` pattern used throughout

### Files to Update

| File | Changes |
|------|---------|
| `packages/types/src/core/user.d.ts` | Rename `SafeUser` → `UserResponse` |
| `packages/types/src/core/debt.d.ts` | Update imports (`DebtDetails` uses `SafeUser`) |
| `packages/types/src/services/debt.service.d.ts` | Update imports |
| `packages/types/src/services/auth.service.d.ts` | Update imports |
| `apps/api/src/types/handler-context.d.ts` | Update `AuthenticatedUser` references |
| `apps/api/src/modules/*/handlers/*.ts` | Update all handler imports |
| `apps/web/src/lib/stores/*.ts` | Update frontend store imports |

### Migration Pattern

```typescript
// Step 1: Add alias for backward compatibility during migration
type SafeUser = UserResponse;  // @deprecated Use UserResponse

// Step 2: Update all imports
import type { UserResponse } from '@repo/types/core/user';  // Was SafeUser

// Step 3: Remove alias after full migration
```

### Related Renames (Optional but Recommended)

| Current | Proposed | Rationale |
|---------|----------|-----------|
| `SafeUser` | `UserResponse` | API response payload |
| `CurrentUser` | `UserContext` | Authenticated user in context |
| `UserWithNotifications` | `UserNotificationPrefs` | Specific purpose |
| `UserEntity` | `User` or keep | Already clear |

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Week 1)

| Day | Task | Files |
|-----|------|-------|
| 1 | Remove `drizzle-valibot` from `packages/db` | All `*.schema.ts` |
| 2 | Migrate `packages/schema` to TypeBox | `common.schema.ts`, create new DTOs |
| 3 | Delete `packages/validation` | Entire package |
| 4 | Update `apps/api` imports | All modules using `@repo/validation` |
| 5 | Fix magic numbers | `create.handler.ts`, `login.handler.ts` |

### Phase 2: API Layer (Week 2)

| Day | Task | Files |
|-----|------|-------|
| 1 | Create `progress-poll.handler.ts` | New file |
| 2 | Delete `sse.handler.ts` | Remove file + route |
| 3 | Fix try-catch violations | `preview.handler.ts`, `s3.service.ts` |
| 4 | Add exception hierarchy | `packages/errors/src/hierarchy.ts` |
| 5 | Test all endpoints | API test suite |

### Phase 3: Frontend (Week 3)

| Day | Task | Files |
|-----|------|-------|
| 1 | Rewrite `import-progress.svelte.ts` | Pure XHR |
| 2 | Update validation imports | All using `@repo/validation` |
| 3 | Add retry logic | Exponential backoff |
| 4 | Test error scenarios | Network failure simulation |
| 5 | End-to-end testing | Full import flow |

### Dependency Graph

```
packages/schema (TypeBox)
    ↑
    ├── apps/api (DTO validation)
    ├── apps/web (Runtime validation)
    └── packages/db (Drizzle types only, NO valibot)

packages/config (Constants)
    ↑
    ├── apps/api
    ├── apps/web
    └── packages/schema

packages/errors (Exception hierarchy)
    ↑
    └── apps/api
```

---

## Appendix: File Inventory

### Files to Delete

| File | Reason |
|------|--------|
| `packages/validation/` | Replaced by `packages/schema` |
| `apps/api/src/modules/data/handlers/sse.handler.ts` | SSE replaced by XHR |
| `packages/db/src/schema/*/insert-schema.ts` | Valibot schemas |

### Files to Create

| File | Purpose |
|------|---------|
| `packages/schema/src/shared/*/index.ts` | TypeBox DTOs per domain |
| `packages/schema/src/db/tables/*.ts` | Drizzle table definitions |
| `apps/api/src/modules/data/handlers/progress-poll.handler.ts` | XHR polling endpoint |
| `packages/errors/src/hierarchy.ts` | Exception hierarchy |

### Files to Modify (High Impact)

| File | Changes |
|------|---------|
| `packages/db/src/schema/*.ts` | Remove `drizzle-valibot` |
| `packages/schema/src/shared/common.schema.ts` | Rewrite in TypeBox |
| `apps/api/src/modules/data/routes.ts` | Replace SSE with XHR route |
| `apps/web/src/lib/stores/import-progress.svelte.ts` | Remove EventSource |
| `apps/api/src/modules/debts/handlers/create.handler.ts` | Fix magic number |
| `apps/api/src/modules/auth/handlers/login.handler.ts` | Fix magic numbers |
| `apps/api/src/modules/data/handlers/preview.handler.ts` | Fix try-catch + Add JSON size limit |
| `apps/api/src/modules/storage/services/s3.service.ts` | Fix error handling |
| `packages/types/src/core/user.d.ts` | Rename `SafeUser` → `UserResponse` |
| `apps/api/src/types/handler-context.d.ts` | Update `AuthenticatedUser` type |

---

**End of Audit**
