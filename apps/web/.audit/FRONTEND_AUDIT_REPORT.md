# Frontend Codebase Audit Report

**Project:** Buddy Wallet Web App  
**Framework:** SvelteKit 2.x (Svelte 5.x Runes Mode)  
**Audit Date:** May 1, 2026  
**Auditor:** Cascade AI Code Review

---

## Executive Summary

| Category | Grade | Status |
|----------|-------|--------|
| **Architecture & State** | A- | Strong (Svelte 5 Runes) |
| **Authentication & Security** | B | Good (Session Refresh Flow) |
| **API Integration** | B- | Desync Risks |
| **UX/UI & Aesthetics** | A | Premium (Tailwind + Shadcn) |
| **Logic Adherence** | C+ | Missing Features |

**Overall Grade: B+ (8.2/10)**

---

## 1. Architecture Analysis

### 1.1 Svelte 5 Adoption
**Status:** ✅ EXCELLENT
- Full migration to Svelte 5 Runes (`$props`, `$state`, `$derived`).
- Clean separation of concerns using `lib/remotes` for server actions and `lib/services` for logic.

### 1.2 State Management
**Status:** ✅ GOOD
- Use of **State Machines** (`$lib/state-machines`) for complex flows like Auth Resolution.
- Centralized stores in `$lib/stores` using Svelte 5's reactivity.

### 1.3 Routing & Middleware
**Status:** ✅ STRONG
- `hooks.server.ts` implements a robust auth resolution strategy.
- Uses `sequence` to handle Paraglide (i18n), Theme, and Auth.
- Permission-based routing guards implemented.

---

## 2. Authentication & Session Management

### 2.1 Double-Fetch Strategy
**Status:** ✅ BEST PRACTICE
- The server hook attempts `/me` and then `refresh` on 401.
- Properly handles cookie forwarding and token rotation.

### 2.2 Broken Login Logic (CRITICAL BUG)
**Status:** ❌ FAILED
- **File:** `src/lib/remotes/auth.remote.ts`
- **Issue:** The `loginRemote` function has a major logic error where it only proceeds to set cookies if `mustChangePassword` is `true`. If `mustChangePassword` is `false`, it hits an `invalid('Unexpected error occurred')` statement.
- **Dead Code:** Most of the session cookie setting logic is unreachable due to premature redirects.

---

## 3. API Integration & Type Safety

### 3.1 Eden Treaty Usage
**Status:** ✅ GOOD
- Uses Eden Treaty for end-to-end type safety with the Elysia backend.
- Shared validation schemas (`@repo/validation`) used in `auth.remote.ts`.

### 3.2 Response Enveloping Mismatch
**Status:** ❌ CRITICAL
- **Envelope Desync**: Backend often returns raw error objects `{ code, message }` or wrapped `{ ok, error }` results. Frontend `ApiResponse` type expects `{ error: { code, message } }`.
- **Impact**: Eden Treaty puts raw errors in the `data` property on 200 OK or `error.value` on 4xx, but without the expected nesting. This causes `undefined` property access in components.

### 3.3 Date Serialization Gap
**Status:** ⚠️ RISK
- Backend returns ISO strings for Dates. Frontend types expect `Date` objects.
- **Problem**: Eden Treaty does not automatically hydrate strings back to `Date` objects.
- **Impact**: UI components will crash or display "Invalid Date" if they attempt to call `.toLocaleDateString()` on a string.

### 3.4 Backend Desync (Suggest/Respond)
**Status:** ⚠️ RISK
- Frontend implements `suggestEdit` and `respondSuggestion` remotes.
- **Problem:** Corresponding handlers do not exist in the backend API.
- This creates "Dead UI" that will fail with 404 errors in production.

---

## 4. UX Logic & Business Adherence

### 4.1 Feature Gaps
Comparing with `UX_Flow_Logic_Business.md`:
- **Debt Confirmation**: UI exists but backend lacks the "Two-Party" logic.
- **Import History**: UI for history listing exists, but the "Re-mapping" flow is missing.
- **Public API**: `/check-debt` route is planned in `hooks.server.ts` but implementation is minimal.

---

## 5. Critical Issues Summary

| Priority | Issue | Location | Impact |
|----------|-------|----------|--------|
| 🔴 **CRITICAL** | Broken Login Logic | `auth.remote.ts` | Users cannot log in normally |
| 🔴 **CRITICAL** | Response Envelope Mismatch | API Integration | Broken error handling & type-safety |
| 🔴 **CRITICAL** | API Desync (Suggestions) | `debts.remote.ts` | 404 errors on core features |
| 🟡 **HIGH** | Date Serialization Gap | Components/Types | UI crashes on date rendering |
| 🟡 **HIGH** | Unreachable Cookie Logic | `auth.remote.ts` | Dead code and session risks |
| 🟡 **HIGH** | Missing Re-mapping Flow | Import Module | UX friction for data imports |
| 🟠 **MEDIUM** | Inconsistent Error Mapping | Remotes | User-unfriendly API error messages |

---

---

## 7. Performance & Race Conditions

### 7.1 Form Remote Race Conditions
**Status:** ⚠️ RISK
- Remotes in `src/lib/remotes/*.ts` do not implement client-side debouncing or optimistic UI states.
- Rapid clicks on "Confirm Debt" or "Delete" will trigger multiple concurrent server requests, which could lead to inconsistent UI states or redundant backend processing.
- **Recommendation**: Implement `pending` state tracking in Svelte 5 components using the remote's execution state.

---

## 8. Security & Data Leakage

### 8.1 Auth Token Leakage
**Status:** ✅ LOW RISK
- `hooks.server.ts` correctly handles tokens on the server side.
- **Verification Needed**: Ensure that the `accessToken` and `refreshToken` are never serialized into the `$page.data` store via `load` functions, which would expose them to client-side scripts.

---

## 9. Recommendations

1. **Immediate**: Fix the logic flow in `auth.remote.ts` to allow normal logins.
2. **Short-term**: Align `debts.remote.ts` with the actual backend API surface.
3. **Architecture**: Implement **JSON-based re-mapping** in S3. Parse uploads to JSON immediately to allow fast, low-latency column mapping from history without re-processing binary Excel files.
4. **UX**: Add loading states and disabled buttons for all "Remote" form actions to prevent race conditions.

---

## 10. Secure Token Management (Verified)

### 10.1 Browser Security
- **Implementation:** **PASSED**. Tokens are stored in `httpOnly`, `Secure` cookies.
- **Result:** No tokens are accessible via `localStorage` or client-side scripts, neutralizing the threat of XSS-based token theft.

### 10.2 Transmission Security
- **Implementation:** **PASSED**. 
  - **Browser-to-API**: Uses `credentials: 'include'` to send cookies automatically.
  - **Server-to-API (SSR)**: Server-side hooks extract cookies and pass them via the `Authorization: Bearer` header.

---

## 11. Auto-Login & Refresh Logic (Verified)

### 11.1 Session Persistence
- **Implementation:** **PASSED**. 90-day expiration on the `refresh_token` cookie allows for long-term "Remember Me" functionality.

### 11.2 Seamless Refresh
- **Implementation:** **PASSED**. `hooks.server.ts` detects expired sessions (401) and performs a silent refresh using the refresh token before the page is rendered.

---

## Conclusion

The frontend codebase is **architecturally superior** to the backend, utilizing modern Svelte 5 features and robust state management. However, it suffers from **major logic errors in the authentication remote** and is currently **decoupled from the backend's actual capabilities**. Fixing the "Dead Logic" and aligning with the backend's roadmap is the top priority.
