# Quick Fixes Reference

Copy-paste ready fixes for post-migration gaps.

---

## 1. Fix SafeUser → UserResponse (Service Files)

### packages/types/src/services/debt.service.d.ts

```typescript
// Line 2: Change import
import type { UserResponse } from '../core/user';  // Was SafeUser

// Line 9: Change usage
createDebt(..., currentUser: UserResponse): Promise<DebtResult>;  // Was SafeUser

// Line 10: Change usage  
updateDebtStatus(..., currentUser: UserResponse): Promise<StatusUpdateResult>;  // Was SafeUser
```

### packages/types/src/services/auth.service.d.ts

```typescript
// Line 2: Change import
import type { UserResponse } from '../core/user';  // Was SafeUser

// Line 28: Change usage
user?: UserResponse;  // Was SafeUser
```

### packages/types/src/services/user.service.d.ts

```typescript
// Line 2: Change import
import type { UserResponse, UserResult } from '../core/user';  // Was SafeUser

// Line 8: Change usage
Promise<PaginatedResult<UserResponse>>  // Was SafeUser
```

### packages/types/src/services/session.service.d.ts

```typescript
// Line 2: Change import
import type { UserResponse } from '../core/user';  // Was SafeUser

// Line 7: Change usage
user: UserResponse;  // Was SafeUser
```

---

## 2. Fix ActivityAction Missing 'import_preview'

### packages/types/src/core/activity.d.ts

Add to line 31 (after 'import'):
```typescript
export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'export'
  | 'import'
  | 'import_preview'    // ← ADD THIS
  | 'status_change'
  | ...
  | string;
```

---

## 3. Fix Unused Parameter

### packages/errors/src/hierarchy.ts

```typescript
// Line 25: Add underscore prefix
constructor(message: string, _field?: string) {  // Was 'field'
  super(message, 'VALIDATION_ERROR', 400);
}
```

---

## 4. TypeBox + Superforms Fix (If Runtime Fails)

### Option: Re-export wrapped schemas

Update `packages/schema/src/dto/auth/register.schema.ts`:

```typescript
import { Type, type Static } from '@sinclair/typebox';
import { toStandardSchema } from '../../adapters/standard-schema';

export const registerRequestSchema = Type.Object({
  name: Type.String({ minLength: 2 }),
  phoneNumber: Type.String({ minLength: 10 }),
  email: Type.Optional(Type.String({ format: 'email' })),
  password: Type.String({ minLength: 8 })
});

// Add wrapped version
export const registerStandardSchema = toStandardSchema(registerRequestSchema);

export type RegisterRequest = Static<typeof registerRequestSchema>;
export const RegisterSchema = registerRequestSchema;
export type RegisterSchema = RegisterRequest;
```

Then in `apps/web/src/routes/(auth)/signup/+page.server.ts`:

```typescript
import { registerStandardSchema } from '@repo/schema/dto/auth';

const form = await superValidate(registerStandardSchema);
```

---

**Apply these fixes in order. Each is self-contained and safe to apply independently.**
