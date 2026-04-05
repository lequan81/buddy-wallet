# @repo/errors — Error Code Catalog

Centralized error codes shared between frontend and backend. All API responses use these codes for consistent, machine-readable error handling.

## Error Code Format

```
{CATEGORY}_{NUMBER}
```

| Category | Prefix | Description |
| -------- | ------ | ----------- |
| Generic | `GEN_` | Shared between frontend and backend |
| Frontend | `FE_` | Client-side errors |
| Backend | `BE_` | Server-side errors |

---

## Generic Errors (`GEN_`)

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `GEN_001` | `UNKNOWN` | 500 | An unknown error occurred |
| `GEN_002` | `NETWORK` | 503 | Network connection failed |
| `GEN_003` | `TIMEOUT` | 408 | Request timed out |
| `GEN_004` | `INVALID_INPUT` | 400 | Invalid input provided |
| `GEN_005` | `NOT_FOUND` | 404 | Resource not found |
| `GEN_006` | `UNAUTHORIZED` | 401 | Authentication required |
| `GEN_007` | `FORBIDDEN` | 403 | Access denied |
| `GEN_008` | `VALIDATION` | 422 | Validation failed |

---

## Frontend Errors (`FE_`)

### Form Errors

| Code | Key | Description |
| ---- | --- | ----------- |
| `FE_001` | `FORM_INVALID` | Form validation failed |
| `FE_002` | `FORM_SUBMIT_FAILED` | Form submission failed |

### File Errors

| Code | Key | Description |
| ---- | --- | ----------- |
| `FE_010` | `FILE_NOT_SELECTED` | No file selected |
| `FE_011` | `FILE_TOO_LARGE` | File size exceeds limit |
| `FE_012` | `FILE_INVALID_TYPE` | Invalid file type |
| `FE_013` | `FILE_EMPTY` | File is empty |

### Import Errors

| Code | Key | Description |
| ---- | --- | ----------- |
| `FE_020` | `IMPORT_NO_CONFIG` | Column mapping not configured |
| `FE_021` | `IMPORT_MISSING_REQUIRED` | Required columns not mapped |
| `FE_022` | `IMPORT_PREVIEW_FAILED` | Failed to preview file |

### API Errors

| Code | Key | Description |
| ---- | --- | ----------- |
| `FE_030` | `API_UNREACHABLE` | Cannot connect to server |
| `FE_031` | `API_RESPONSE_INVALID` | Invalid response from server |

---

## Backend Errors (`BE_`)

### Database Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_001` | `DB_CONNECTION` | 500 | Database connection failed |
| `BE_002` | `DB_QUERY` | 500 | Database query failed |
| `BE_003` | `DB_INSERT` | 500 | Failed to insert record |
| `BE_004` | `DB_UPDATE` | 500 | Failed to update record |
| `BE_005` | `DB_DELETE` | 500 | Failed to delete record |

### Auth Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_010` | `AUTH_TOKEN_EXPIRED` | 401 | Authentication token expired |
| `BE_011` | `AUTH_TOKEN_INVALID` | 401 | Invalid authentication token |
| `BE_012` | `AUTH_SESSION_EXPIRED` | 401 | Session expired |
| `BE_013` | `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `BE_014` | `AUTH_PHONE_EXISTS` | 409 | Phone number already registered |
| `BE_015` | `AUTH_EMAIL_EXISTS` | 409 | Email already registered |
| `BE_016` | `AUTH_INVALID_PHONE` | 400 | Invalid phone number format |
| `BE_017` | `AUTH_NO_SESSION` | 401 | No valid session |
| `BE_018` | `AUTH_PASSWORD_MISMATCH` | 400 | Current password is incorrect |

### Email Verification Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_050` | `EMAIL_OTP_EXPIRED` | 400 | Verification code has expired |
| `BE_051` | `EMAIL_OTP_INVALID` | 400 | Invalid verification code |
| `BE_052` | `EMAIL_ALREADY_VERIFIED` | 409 | Email is already verified |
| `BE_053` | `EMAIL_SEND_FAILED` | 500 | Failed to send verification email |
| `BE_054` | `EMAIL_TOO_MANY_ATTEMPTS` | 429 | Too many verification attempts |

### Import/Export Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_020` | `IMPORT_PARSE_ERROR` | 400 | Failed to parse file |
| `BE_021` | `IMPORT_EMPTY_SHEET` | 400 | File contains no data |
| `BE_022` | `IMPORT_INVALID_FORMAT` | 400 | Invalid file format |
| `BE_023` | `IMPORT_ROW_ERROR` | 400 | Error processing row |
| `BE_024` | `EXPORT_FAILED` | 500 | Export generation failed |
| `BE_025` | `EXPORT_NO_DATA` | 400 | No data to export |

### User Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_030` | `USER_NOT_FOUND` | 404 | User not found |
| `BE_031` | `USER_INACTIVE` | 403 | User account is inactive |

### Debt Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_035` | `DEBT_NOT_FOUND` | 404 | Debt not found |
| `BE_036` | `DEBT_INVALID_STATUS` | 400 | Invalid status transition |
| `BE_037` | `DEBT_PERMISSION_DENIED` | 403 | Not authorized to modify this debt |

### Rate Limiting

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_040` | `RATE_LIMITED` | 429 | Too many requests |

### File Upload Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_060` | `FILE_TOO_LARGE` | 413 | File size exceeds the allowed limit |
| `BE_061` | `FILE_INVALID_TYPE` | 400 | File type is not allowed |
| `BE_062` | `FILE_UPLOAD_FAILED` | 500 | File upload failed |
| `BE_063` | `FILE_NOT_FOUND` | 404 | File not found |
| `BE_064` | `FILE_PERMISSION_DENIED` | 403 | Not authorized to access this file |
| `BE_065` | `FILE_CONTENT_MISMATCH` | 400 | File content does not match its extension |
| `BE_066` | `FILE_QUEUE_FULL` | 503 | Upload queue is full, try again later |

### Push Notification Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_070` | `PUSH_SUBSCRIPTION_FAILED` | 500 | Failed to create push subscription |
| `BE_071` | `PUSH_SUBSCRIPTION_NOT_FOUND` | 404 | Push subscription not found |
| `BE_072` | `PUSH_SEND_FAILED` | 500 | Failed to send push notification |
| `BE_073` | `PUSH_INVALID_SUBSCRIPTION` | 400 | Invalid push subscription data |

### Bank Account Errors

| Code | Key | HTTP Status | Description |
| ---- | --- | ----------- | ----------- |
| `BE_080` | `BANK_ACCOUNT_NOT_FOUND` | 404 | Bank account not found |
| `BE_081` | `BANK_ACCOUNT_LIMIT` | 400 | Maximum number of bank accounts reached |
| `BE_082` | `BANK_ACCOUNT_DUPLICATE` | 409 | Bank account already exists |
| `BE_083` | `BANK_ACCOUNT_PERMISSION_DENIED` | 403 | Not authorized to manage this bank account |

---

## Usage

```typescript
import { BE_ERRORS, GEN_ERRORS, apiResponse } from '@repo/errors';

// In controllers:
if (!user) {
  set.status = 401;
  return apiResponse({ ok: false, error: GEN_ERRORS.UNAUTHORIZED });
}

// With details:
if (!debt) {
  set.status = 404;
  return apiResponse({ ok: false, error: BE_ERRORS.DEBT_NOT_FOUND, details: `Debt ID: ${id}` });
}

// Success:
return apiResponse({ ok: true, data: { debt } });
```
