/**
 * Debts Module Schema Definitions
 * 
 * TypeBox definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';

// Create debt schema
export const CreateDebtSchema = t.Object({
  debtorId: t.String({
    format: 'uuid',
    error: 'Invalid debtor ID'
  }),
  amount: t.Number({
    minimum: 1,
    error: 'Amount must be greater than 0'
  }),
  currency: t.String({
    minLength: 3,
    maxLength: 3,
    error: 'Invalid currency code (e.g., USD, VND)'
  }),
  description: t.Optional(t.String({
    minLength: 1,
    maxLength: 500,
    error: 'Description must be between 1 and 500 characters'
  })),
  dueDate: t.Optional(t.Date())
});

// Update debt schema
export const UpdateDebtSchema = t.Object({
  amount: t.Optional(t.Number({
    minimum: 1,
    error: 'Amount must be greater than 0'
  })),
  currency: t.Optional(t.String({
    minLength: 3,
    maxLength: 3,
    error: 'Invalid currency code (e.g., USD, VND)'
  })),
  description: t.Optional(t.String({
    minLength: 1,
    maxLength: 500,
    error: 'Description must be between 1 and 500 characters'
  })),
  dueDate: t.Optional(t.Date())
});

// Debt status schema
export const DebtStatusSchema = t.Object({
  status: t.Union([
    t.Literal('pending'),
    t.Literal('confirmed'),
    t.Literal('cancelled'),
    t.Literal('paid')
  ])
});

// Cancel debt schema
export const CancelDebtSchema = t.Object({
  reason: t.Optional(t.String({
    maxLength: 500,
    error: 'Reason must be less than 500 characters'
  }))
});

// Confirm debt schema
export const ConfirmDebtSchema = t.Object({
  proofImageId: t.Optional(t.String())
});

// Batch delete schema
export const BatchDeleteSchema = t.Object({
  ids: t.Array(t.String({ format: 'uuid' }), { minItems: 1 })
});

// Delete all schema
export const DeleteAllQuerySchema = t.Object({
  confirm: t.Literal('true')
});

// List debts query schema
export const ListDebtsQuerySchema = t.Object({
  status: t.Optional(t.Union([
    t.Literal('pending'),
    t.Literal('confirmed'),
    t.Literal('paid'),
    t.Literal('disputed'),
    t.Literal('cancelled')
  ])),
  direction: t.Optional(t.Union([
    t.Literal('LEND'),
    t.Literal('BORROW')
  ])),
  sortBy: t.Optional(t.Union([
    t.Literal('createdAt'),
    t.Literal('amount'),
    t.Literal('status'),
    t.Literal('updatedAt')
  ])),
  sortOrder: t.Optional(t.Union([
    t.Literal('asc'),
    t.Literal('desc')
  ])),
  page: t.Optional(t.Number({
    minimum: 1,
    default: 1
  })),
  limit: t.Optional(t.Number({
    minimum: 1,
    maximum: 100,
    default: 20
  }))
});

// Suggest edit schema
export const SuggestEditSchema = t.Object({
  amount: t.Optional(t.Number({
    minimum: 1,
    error: 'Amount must be greater than 0'
  })),
  description: t.Optional(t.String({
    minLength: 1,
    maxLength: 500,
    error: 'Description must be between 1 and 500 characters'
  }))
});

// Respond to suggestion schema
export const RespondSuggestionSchema = t.Object({
  accept: t.Boolean({
    error: 'Accept must be a boolean'
  })
});

// Response schemas
export const DebtResponseSchema = t.Object({
  id: t.String(),
  amount: t.Number(),
  currency: t.String(),
  debtorId: t.String(),
  creditorId: t.String(),
  status: t.String(),
  description: t.Optional(t.String()),
  dueDate: t.Optional(t.Date()),
  createdAt: t.Date(),
  updatedAt: t.Optional(t.Date())
});

export const DebtListResponseSchema = t.Object({
  data: t.Array(DebtResponseSchema),
  meta: t.Object({
    total: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    totalPages: t.Number()
  })
});
