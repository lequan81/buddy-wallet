/**
 * Bank Module Schema Definitions
 * 
 * TypeBox definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import { t } from 'elysia';

// Create bank account schema
export const CreateBankAccountSchema = t.Object({
  bankName: t.String({
    minLength: 2,
    maxLength: 100,
    error: 'Bank name must be between 2 and 100 characters'
  }),
  accountNumber: t.String({
    minLength: 8,
    maxLength: 20,
    error: 'Account number must be between 8 and 20 characters'
  }),
  accountName: t.String({
    minLength: 2,
    maxLength: 100,
    error: 'Account name must be between 2 and 100 characters'
  }),
  isDefault: t.Optional(t.Boolean())
});

// Update bank account schema
export const UpdateBankAccountSchema = t.Object({
  bankName: t.Optional(t.String({
    minLength: 2,
    maxLength: 100
  })),
  accountNumber: t.Optional(t.String({
    minLength: 8,
    maxLength: 20
  })),
  accountName: t.Optional(t.String({
    minLength: 2,
    maxLength: 100
  })),
  isDefault: t.Optional(t.Boolean())
});

// List bank accounts query schema
export const ListBankAccountsQuerySchema = t.Object({
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

// Response schemas
export const BankAccountResponseSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  bankName: t.String(),
  accountNumber: t.String(),
  accountName: t.String(),
  isDefault: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Optional(t.Date())
});

export const BankAccountListResponseSchema = t.Object({
  data: t.Array(BankAccountResponseSchema),
  meta: t.Object({
    total: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    totalPages: t.Number()
  })
});
