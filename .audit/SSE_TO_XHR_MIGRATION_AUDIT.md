# Buddy Wallet: SSE to XHR Migration Audit

**Date:** May 2026  
**Scope:** Complete replacement of SSE with XHR long-polling for import progress tracking  
**Status:** ⚠️ CRITICAL GAPS IDENTIFIED

---

## Executive Summary

The codebase currently uses **SSE (Server-Sent Events)** for real-time import progress tracking via `GET /data/import/progress-sse`. The frontend (`import-progress.svelte.ts`) implements a hybrid approach: SSE primary with XHR polling fallback.

**CRITICAL FINDING:** The frontend's fallback polling calls `api.v1.import['progress-batch'].post()` — **this endpoint does NOT exist in the backend**. The fallback is broken.

**Migration Decision:** Replace SSE completely with XHR long-polling (Google Drive pattern). No backward compatibility.

---

## Current State Analysis

### Backend: SSE Implementation

```
Endpoint: GET /data/import/progress-sse?logIds=id1,id2,...
File:     apps/api/src/modules/data/handlers/sse.handler.ts
Status:   FUNCTIONAL BUT TO BE REMOVED
```

**Current SSE Features:**
| Feature | Implementation | Migration Needed |
|---------|---------------|------------------|
| Connection | `ReadableStream` with SSE headers | Remove |
| Auto-reconnect | Client-side `EventSource` | Replace with XHR retry logic |
| Multi-job tracking | `logIds` query param (comma-separated) | Keep in XHR POST body |
| Polling fallback | 1-second Redis hash polling | Replace with explicit XHR interval |
| Terminal detection | Auto-close when all jobs done | Keep in XHR response handling |
| Error handling | `onerror` → fallback | Replace with HTTP error handling |

### Backend: Individual Progress Endpoint

```
Endpoint: GET /data/import/:id/progress
File:     apps/api/src/modules/data/handlers/import.handler.ts:102
Status:   FUNCTIONAL (DB query only, no Redis)
```

**Limitation:** Queries DB import log — does NOT read from Redis job progress. Misses real-time worker updates.

### Frontend: Hybrid Implementation

```
File: apps/web/src/lib/stores/import-progress.svelte.ts
Pattern: SSE primary → XHR polling fallback (BROKEN)
```

**Current Frontend Logic:**
```typescript
// Primary: SSE
startSSE(url) → EventSource('/v1/import/progress-sse?logIds=...')

// Fallback: XHR polling (BROKEN - endpoint doesn't exist)
fallbackToPolling() → api.v1.import['progress-batch'].post({ logIds })
```

---

## Migration Requirements

### 1. Remove SSE Completely

**Files to Modify/Delete:**

| File | Action | Reason |
|------|--------|--------|
| `apps/api/src/modules/data/handlers/sse.handler.ts` | **DELETE** | Entire SSE handler |
| `apps/api/src/modules/data/routes.ts:46-49` | **DELETE** | SSE route registration |
| `apps/web/src/lib/stores/import-progress.svelte.ts` | **REWRITE** | Remove SSE, pure XHR |

### 2. Create XHR Long-Polling Endpoint

**New Endpoint Design:**

```typescript
// POST /data/import/progress-poll
// Body: { logIds: string[] }
// Response: { [logId]: ImportProgress }
// Headers: Cache-Control: no-cache

interface ProgressPollRequest {
  logIds: string[];        // Max 20 IDs (same limit as SSE)
}

interface ProgressPollResponse {
  data: {
    [logId: string]: {
      status: 'queued' | 'processing' | 'success' | 'failed' | 'cancelled';
      current: number;
      total: number;
      percentage: number;
      message?: string;
      errors?: string[];
      result?: { importedCount: number; errorCount: number };
    }
  };
  meta: {
    hasActiveJobs: boolean;  // false = all terminal (client can stop polling)
    serverTime: string;      // ISO timestamp for sync
  }
}
```

**Implementation Requirements:**

1. **Read from Redis first** (real-time worker progress)
2. **Fallback to DB** (if Redis unavailable)
3. **Return `hasActiveJobs: boolean`** — tells client if polling should continue
4. **No caching headers** — ensure fresh data every request

### 3. XHR Client Implementation (SSE Features to Preserve)

**Required XHR Behaviors:**

| SSE Feature | XHR Equivalent | Implementation |
|-------------|----------------|----------------|
| Auto-reconnect | Exponential backoff retry | 1s → 2s → 4s → 8s → max 30s |
| Connection keep-alive | AbortController timeout | 30s request timeout |
| Event parsing | JSON response | `response.json()` |
| onopen/onmessage | Promise resolution | `fetch().then()` |
| onerror | catch + retry logic | `catch(retryWithBackoff)` |
| Connection close | `controller.close()` signal | `clearInterval(pollingInterval)` |
| Multi-tab sync | `BroadcastChannel` | Share polling state across tabs |

**XHR Long-Polling Pattern (Google Drive Style):**

```typescript
class XHRProgressPoller {
  private abortController: AbortController | null = null;
  private retryDelay = 1000;
  private maxRetryDelay = 30000;
  private pollingInterval = 1000; // 1s between polls when active
  
  async poll(logIds: string[]): Promise<void> {
    this.abortController = new AbortController();
    
    try {
      const response = await fetch('/v1/import/progress-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logIds }),
        signal: this.abortController.signal
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      this.applyProgressUpdates(result.data);
      
      // Reset retry delay on success
      this.retryDelay = 1000;
      
      // Stop if all jobs terminal
      if (!result.meta.hasActiveJobs) {
        this.stop();
        return;
      }
      
      // Schedule next poll
      setTimeout(() => this.poll(logIds), this.pollingInterval);
      
    } catch (error) {
      if (error.name === 'AbortError') return; // Intentional stop
      
      // Exponential backoff retry
      console.warn(`[Progress] Poll failed, retrying in ${this.retryDelay}ms`);
      setTimeout(() => this.poll(logIds), this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay);
    }
  }
  
  stop() {
    this.abortController?.abort();
  }
}
```

---

## Critical Gaps & Issues

### 🔴 CRITICAL: Missing Batch Progress Endpoint

**Issue:** Frontend references `api.v1.import['progress-batch'].post()` but backend has no such endpoint.

**Impact:** SSE fallback is non-functional. If SSE fails, user sees no progress updates.

**Fix:** Create `POST /data/import/progress-poll` (as specified above).

### 🔴 CRITICAL: Individual Progress Doesn't Read Redis

**Issue:** `GET /data/import/:id/progress` queries DB only, misses real-time worker progress from Redis.

**Current Code:**
```typescript
// import.handler.ts:102-118
getProgress: async ({ params, user, set }: ImportProgressContext) => {
  const log = await importRepo.getLogById(params.id, user.id);  // DB only!
  // ... returns log.status (stale)
}
```

**Fix:** Check Redis first, fallback to DB:
```typescript
const redisStatus = await getJobStatus(params.id);
if (redisStatus?.progress) {
  return apiSuccess(redisStatus.progress);  // Real-time
}
// Fallback to DB query
```

### 🟡 WARNING: SSE Route Still Active

**Issue:** SSE endpoint will remain active until explicitly removed. Frontend might still use it if code isn't cleaned.

**Fix:** 
1. Delete `sse.handler.ts`
2. Remove route from `routes.ts`
3. Remove `EventSource` from frontend store

---

## Implementation Roadmap

### Phase 1: Backend XHR Endpoint (Day 1)

1. **Create** `apps/api/src/modules/data/handlers/progress-poll.handler.ts`
   - POST handler accepting `{ logIds: string[] }`
   - Read from Redis job status (via `getJobStatus`)
   - Fallback to DB import log
   - Return `hasActiveJobs` flag

2. **Update** `apps/api/src/modules/data/routes.ts`
   - Add `POST /import/progress-poll` route
   - Remove `GET /import/progress-sse` route

3. **Delete** `apps/api/src/modules/data/handlers/sse.handler.ts`

### Phase 2: Frontend XHR Rewrite (Day 2)

1. **Rewrite** `apps/web/src/lib/stores/import-progress.svelte.ts`
   - Remove all `EventSource` code
   - Implement XHR poller with exponential backoff
   - Add `BroadcastChannel` for multi-tab sync
   - Preserve FSM (finite state machine) transitions

2. **Update** API client types to remove SSE references

### Phase 3: Cleanup & Testing (Day 3)

1. **Remove** SSE-related types from `@repo/types`
2. **Add** tests for `progress-poll` endpoint
3. **Add** tests for XHR retry logic
4. **Verify** Redis queue name alignment (critical from previous audit)

---

## File Change Summary

### Backend

| File | Change | Lines |
|------|--------|-------|
| `apps/api/src/modules/data/handlers/sse.handler.ts` | **DELETE** | -200 |
| `apps/api/src/modules/data/handlers/progress-poll.handler.ts` | **CREATE** | +120 |
| `apps/api/src/modules/data/routes.ts` | Modify | ±10 |
| `apps/api/src/modules/data/handlers/import.handler.ts` | Enhance `getProgress` | +15 |

### Frontend

| File | Change | Lines |
|------|--------|-------|
| `apps/web/src/lib/stores/import-progress.svelte.ts` | **REWRITE** | ±150 |
| `apps/web/src/lib/services/api.ts` | Remove SSE types | ±5 |

---

## Architecture Comparison

### Before (Hybrid SSE + Broken Fallback)

```
┌─────────────┐     SSE Connection      ┌──────────────┐
│   Browser   │ ←────────────────────→ │  API Server  │
│  EventSource│    (long-lived)         │  SSE Handler │
└─────────────┘                         └──────────────┘
     ↓                                          ↓
┌─────────────┐                         ┌──────────────┐
│  Fallback   │ ──XHR (BROKEN)────────→ │   MISSING    │
│   Polling   │    /progress-batch?     │   ENDPOINT   │
└─────────────┘                         └──────────────┘
```

### After (Pure XHR Long-Polling)

```
┌─────────────┐     POST /progress-poll    ┌──────────────┐
│   Browser   │ ←────────────────────────→ │  API Server  │
│  XHR Poller │   (1s interval, retry)     │ Poll Handler │
└─────────────┘                            └──────────────┘
     ↓                                           ↓
┌─────────────┐                            ┌──────────────┐
│  Exponential│                            │  Redis Job   │
│   Backoff   │                            │   Status     │
│   Retry     │                            └──────────────┘
└─────────────┘
```

---

## Benefits of XHR over SSE

| Aspect | SSE | XHR Long-Polling |
|--------|-----|------------------|
| Proxy/Firewall | Often blocked | Always works |
| Connection Limit | 6 per domain | Shares HTTP pool |
| Retry Control | Limited | Full exponential backoff |
| Error Context | Generic `onerror` | HTTP status codes |
| Auth Headers | Limited support | Full header support |
| Request Body | URL only (GET) | Full JSON body |
| Connection Recovery | Auto but opaque | Explicit, controlled |
| Mobile Networks | Unreliable | More reliable |
| Server Complexity | Streaming logic | Simple request/response |

---

## Next Steps

1. **Approve this audit** — Confirm SSE complete removal
2. **Create `progress-poll` handler** — Implement XHR endpoint
3. **Rewrite frontend store** — Pure XHR with retry logic
4. **Delete SSE handler** — Clean removal
5. **Test retry scenarios** — Simulate network failures

---

## Appendix: Redis Queue Name Verification

**From Previous Audit:** Ensure API and Worker use identical queue names.

| Component | Current | Should Be |
|-----------|---------|-----------|
| API `enqueueJob` | `'imports'` | Verify match |
| Worker `dequeueJob` | `'imports'` | Verify match |
| API `createJob('import-process')` | Type check | Verify match |
| Worker job type check | `'import-process'` | Verify match |

**Action:** Run `grep -r "enqueueJob\|dequeueJob" apps/api apps/worker` to verify alignment before migration.
