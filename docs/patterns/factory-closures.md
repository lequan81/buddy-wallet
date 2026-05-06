# Factory Closure Pattern

## Overview

Replace class-based services with factory closures for:
- No `this` binding issues
- True private state (closure scope)
- Easier to test (just pass mocks)
- No `new` keyword complexity

## Example

```typescript
// BEFORE — class with DI
class DebtService {
  constructor(
    private debtRepo: DebtRepository,
    private userRepo: UserRepository
  ) {}
  async create(data: CreateDebtInput) { ... }
}

// AFTER — factory closure
export function createDebtService(
  debtRepo: DebtRepository,
  userRepo: UserRepository
) {
  return {
    async create(data: CreateDebtInput): Promise<Result<Debt>> {
      const user = await userRepo.findById(data.counterpartyPhone);
      if (!user) return { code: 'USER_NOT_FOUND', error: '...' };
      return debtRepo.create(data);
    }
  };
}

// Usage
const debtService = createDebtService(debtRepo, userRepo);
const result = await debtService.create(data);
```

## Migration Guide

1. Start with NEW services — use factory closures
2. Existing class-based services — migrate when refactoring
3. Do NOT do a big-bang rewrite
