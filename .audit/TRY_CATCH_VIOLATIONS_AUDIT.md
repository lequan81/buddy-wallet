# try-catch Pattern Violations Audit

**Date:** May 3, 2026  
**Scope:** Exception handling anti-patterns in apps/api  
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## Principle

> **try-catch is ONLY for exceptional, unrecoverable errors (I/O, network, external services).**  
> **Validation uses if-else or Result types.**  
> **Catch only what you can resolve; otherwise propagate up.**

---

## Violation Patterns Found

### ❌ Pattern 1: try-catch for Validation (NOT FIXED)

**Location:** `apps/api/src/modules/data/handlers/preview.handler.ts:53-58`

**Current Code:**
```typescript
let parsed;
try {
  parsed = await parseSpreadsheetFile(buffer, file.name);
} catch (err) {
  set.status = 400;
  return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, `Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
}
```

**Problem:** Using try-catch for validation logic. File parsing should return a Result type.

**Required Fix:**
```typescript
const result = await parseSpreadsheetFile(buffer, file.name);
if ('code' in result) {
  return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, result.message);
}
const parsed = result.data;
```

**Status:** 🔴 STILL BROKEN - needs Result type implementation in parseSpreadsheetFile

**Root Cause Files:**

| File | Issue |
|------|-------|
| `apps/api/src/modules/data/services/import-preview.service.ts:116-184` | `parseSpreadsheetFile` throws on Excel/CSV errors instead of returning Result type |
| `apps/worker/src/parser.ts:19-42` | `parseFile` uses try-catch but re-throws as generic Error |

**Current Flow (Broken):**
```typescript
// import-preview.service.ts - throws on error (line 137)
await workbook.xlsx.load(buffer.buffer.slice(...) as ArrayBuffer);  // Can throw

// preview.handler.ts - catches for validation (anti-pattern)
try {
  parsed = await parseSpreadsheetFile(buffer, file.name);
} catch (err) {
  return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, ...);
}
```

**Complete Fix for import-preview.service.ts:**
```typescript
export type ParseResult = 
  | { kind: 'success'; data: ParsedSpreadsheet }
  | { kind: 'error'; code: string; message: string };

export async function parseSpreadsheetFile(
  buffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    const ext = fileName.toLowerCase().split('.').pop();

    if (ext === 'csv') {
      const csvContent = buffer.toString('utf-8');
      const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const worksheet = workbook.addWorksheet('Sheet 1');
      for (const line of lines) {
        const cells = line.split(',').map((cell) => cell.trim().replace(/^["']|["']$/g, ''));
        worksheet.addRow(cells);
      }
    } else {
      await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount === 0) {
      return { kind: 'success', data: { headers: [], rows: [], totalRows: 0, fileName } };
    }

    // ... rest of extraction logic ...
    return { 
      kind: 'success', 
      data: { headers: validHeaders, rows, totalRows: rows.length, fileName } 
    };
  } catch (err) {
    return { 
      kind: 'error', 
      code: 'PARSE_ERROR',
      message: `Failed to parse ${fileName}: ${err instanceof Error ? err.message : String(err)}` 
    };
  }
}
```

**Complete Fix for preview.handler.ts:**
```typescript
const result = await parseSpreadsheetFile(buffer, file.name);
if (result.kind === 'error') {
  set.status = 400;
  return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, result.message);
}
const parsed = result.data;
```

**Complete Fix for worker parser.ts:**
```typescript
export type FileParseResult =
  | { kind: 'success'; rows: string[][] }
  | { kind: 'error'; code: string; message: string };

export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<FileParseResult> {
  const isCSV = fileName.toLowerCase().endsWith('.csv');
  
  if (isCSV) {
    try {
      const text = buffer.toString('utf-8');
      return { kind: 'success', rows: parseCSV(text) };
    } catch (err) {
      return { 
        kind: 'error', 
        code: 'CSV_PARSE_ERROR',
        message: `Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}` 
      };
    }
  }
  
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    
    if (!worksheet) {
      return { kind: 'error', code: 'EMPTY_WORKBOOK', message: 'No worksheet found in Excel file' };
    }

    const allRows: string[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const rowValues: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowValues.push(cell.value !== null && cell.value !== undefined ? String(cell.value) : '');
      });
      allRows.push(rowValues);
    });
    return { kind: 'success', rows: allRows };
  } catch (err) {
    logger.error('[Parser] Excel loading failed', { error: String(err) });
    return { 
      kind: 'error', 
      code: 'EXCEL_PARSE_ERROR',
      message: 'Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.' 
    };
  }
}
```

---

### ❌ Pattern 2: Silent/Empty Error Swallowing (STILL PRESENT)

**Locations:** Multiple files using `catch {` without error parameter

| File | Line | Issue |
|------|------|-------|
| `apps/api/src/modules/system/services/system.service.ts` | 26, 44, 61 | Health checks use `catch { return 'down'; }` |
| `apps/api/src/modules/data/handlers/import.handler.ts` | 131, 176 | JSON.parse with `catch {` |
| `apps/api/src/modules/storage/handlers/proof.handler.ts` | 95, 97 | Transaction + delete catch |
| `apps/api/src/modules/data/handlers/progress-poll.handler.ts` | 53-58 | Error parsing with `catch {` |

**Specific Issues:**

#### system.service.ts (Health checks - ACCEPTABLE but should be explicit)
```typescript
// Line 26, 44, 61 - All use catch without error parameter
try {
  await db.select().from(users).limit(1);
  return 'up';
} catch {
  return 'down';  // ❌ Error dropped silently
}
```

**Fix:** Add error logging or use `_err` to indicate intentional ignore:
```typescript
} catch (_err) {
  logger.debug('Health check failed', { service: 'database', error: _err });
  return 'down';
}
```

#### import.handler.ts (JSON.parse with no error context)
```typescript
// Line 129-133
try {
  errors = JSON.parse(log.errors as string);
} catch {
  errors = [String(log.errors)];  // ❌ Silent fallback
}
```

**Fix:**
```typescript
} catch (_parseErr) {
  logger.warn('Failed to parse error log JSON', { logId: log.id });
  errors = [String(log.errors)];
}
```

#### import.handler.ts (S3 read with no context)
```typescript
// Line 172-178
try {
  const { importStorage } = await import('@/providers/storage/storage');
  const buffer = await importStorage.read(s3Key);
  parsedData = JSON.parse(buffer.toString());
} catch {
  set.status = 500;
  return apiError(GEN_ERRORS.UNKNOWN, 'Failed to read stored preview data');  // ❌ No error context
}
```

**Fix:**
```typescript
} catch (err) {
  logger.error('Failed to read preview data from S3', { s3Key, error: String(err) });
  set.status = 500;
  return apiError(GEN_ERRORS.UNKNOWN, 'Failed to read stored preview data');
}
```

#### proof.handler.ts (Transaction catch)
```typescript
// Line 95-100
try {
  // ... transaction ...
} catch {
  // Rollback: delete uploaded file if DB transaction fails
  await uploadStorage.delete(key).catch(() => {});  // ❌ Nested empty catch
  set.status = 500;
  return apiError(BE_ERRORS.FILE_UPLOAD_FAILED);
}
```

**Fix:**
```typescript
} catch (txErr) {
  logger.error('Transaction failed for proof upload', { debtId, userId: user.id, error: String(txErr) });
  // Rollback: delete uploaded file if DB transaction fails
  await uploadStorage.delete(key).catch((deleteErr) => {
    logger.warn('Failed to cleanup file after transaction failure', { key, error: String(deleteErr) });
  });
  set.status = 500;
  return apiError(BE_ERRORS.FILE_UPLOAD_FAILED);
}
```

#### progress-poll.handler.ts (JSON parse)
```typescript
// Line 45-53
try {
  errors = JSON.parse(log.errors as string);
} catch {
  errors = [String(log.errors)];  // ❌ Silent fallback
}
```

---

### ❌ Pattern 3: Generic catch Without Context (FOUND)

**Location:** Multiple files with generic `catch` blocks

| File | Line | Issue |
|------|------|-------|
| `apps/api/src/modules/data/handlers/preview.handler.ts` | 88 | S3 save with no context |
| `apps/api/src/workers/import.worker.ts` | 151 | S3 read error |

**Current:**
```typescript
// preview.handler.ts:86-91
try {
  await importStorage.save(s3Key, jsonBuffer);
} catch (err) {
  set.status = 500;
  return apiError(GEN_ERRORS.UNKNOWN, `Failed to store preview data: ${err instanceof Error ? err.message : String(err)}`);
}
```

This is actually okay - it propagates the error. But could be better:
```typescript
} catch (err) {
  logger.error('S3 save failed for preview', { s3Key, size: jsonBuffer.length, error: String(err) });
  set.status = 500;
  return apiError(BE_ERRORS.STORAGE_ERROR, 'Failed to store preview data');
}
```

---

## Exception Hierarchy Implementation Status

**File:** `packages/errors/src/hierarchy.ts` - ✅ CREATED but not fully integrated

**Current State:**
- `AppError` base class ✅
- `ValidationError` ✅
- `NotFoundError` ✅
- `BusinessError` ✅
- `StorageError` ✅
- `AuthError` ✅

**Usage:** Not widely adopted - most handlers still use `apiError()` with error codes instead of throwing exceptions.

---

## Missing Error Catalog Integration

**Files still using raw error strings:**

| File | Line | Current | Should Use |
|------|------|---------|------------|
| `preview.handler.ts` | 57 | String interpolation | `BE_ERRORS.IMPORT_PARSE_ERROR` with context |
| `preview.handler.ts` | 90 | String interpolation | `BE_ERRORS.STORAGE_ERROR` |
| `import.handler.ts` | 178 | Generic message | `BE_ERRORS.STORAGE_READ_ERROR` |

---

## Complete Fix List by File

### apps/api/src/modules/data/handlers/preview.handler.ts

```typescript
// Line 53-58 - Change to Result type pattern
const result = await parseSpreadsheetFile(buffer, file.name);
if ('code' in result) {
  return apiError(BE_ERRORS.IMPORT_PARSE_ERROR, result.message);
}
const parsed = result.data;

// Line 86-91 - Add error context
} catch (err) {
  logger.error('S3 save failed for preview', { s3Key, error: String(err) });
  set.status = 500;
  return apiError(BE_ERRORS.STORAGE_ERROR, 'Failed to store preview data');
}
```

### apps/api/src/modules/data/handlers/import.handler.ts

```typescript
// Line 129-133 - Add context
} catch (_parseErr) {
  logger.warn('Failed to parse error log JSON', { logId: params.id });
  errors = [String(log.errors)];
}

// Line 172-178 - Add context
} catch (err) {
  logger.error('S3 read failed for remap', { s3Key, error: String(err) });
  set.status = 500;
  return apiError(BE_ERRORS.STORAGE_ERROR, 'Failed to read stored preview data');
}
```

### apps/api/src/modules/data/handlers/progress-poll.handler.ts

```typescript
// Line 45-53 - Add context
} catch (_parseErr) {
  logger.warn('Failed to parse progress errors JSON', { logId });
  errors = [String(log.errors)];
}
```

### apps/api/src/modules/storage/handlers/proof.handler.ts

```typescript
// Line 95-100 - Add context
} catch (txErr) {
  logger.error('Transaction failed for proof upload', { debtId, error: String(txErr) });
  await uploadStorage.delete(key).catch((deleteErr) => {
    logger.warn('Cleanup failed after transaction error', { key, error: String(deleteErr) });
  });
  set.status = 500;
  return apiError(BE_ERRORS.FILE_UPLOAD_FAILED);
}
```

### apps/api/src/modules/system/services/system.service.ts

```typescript
// Line 26, 44, 61 - Add debug logging
} catch (_err) {
  logger.debug('Health check failed', { service: 'database', error: _err });
  return 'down';
}
```

---

## Severity Assessment

| Pattern | Severity | Count | Risk |
|---------|----------|-------|------|
| Validation via try-catch | 🔴 High | 1 | Logic error, user feedback issues |
| Silent error swallowing | 🔴 High | 8 | Debugging nightmare, silent failures |
| Generic catch (no context) | 🟡 Medium | 2 | Harder to debug |
| Missing error catalog use | 🟡 Medium | 3 | Inconsistent error responses |

---

## Recommended Action Plan

1. **Phase 1 - Critical (Do Now):**
   - Fix `preview.handler.ts` to use Result type for validation
   - Add error context to all `catch {` blocks
   - Fix nested empty catch in `proof.handler.ts`

2. **Phase 2 - Important (This Week):**
   - Integrate exception hierarchy into handlers
   - Add error catalog codes for storage operations
   - Add debug logging to health checks

3. **Phase 3 - Nice to Have:**
   - Migrate all handlers to throw AppError instead of returning apiError
   - Add error telemetry/metrics

---

**End of Audit**
