/**
 * Bank Module Schema Definitions
 * 
 * Valibot definitions for validation - Schema is Single Source of Truth
 * Following ElysiaJS schema-first & type-driven development
 */

import * as v from 'valibot';

// Create bank account schema
export const CreateBankAccountSchema = v.object({
  bankName: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
  bankCode: v.pipe(v.string(), v.minLength(1)),
  bankBin: v.pipe(v.string(), v.minLength(1)),
  accountNumber: v.pipe(v.string(), v.minLength(8), v.maxLength(20)),
  accountName: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
  isDefault: v.optional(v.boolean())
});

// Update bank account schema
export const UpdateBankAccountSchema = v.object({
  bankName: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(100))),
  bankCode: v.optional(v.pipe(v.string(), v.minLength(1))),
  bankBin: v.optional(v.pipe(v.string(), v.minLength(1))),
  accountNumber: v.optional(v.pipe(v.string(), v.minLength(8), v.maxLength(20))),
  accountName: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(100))),
  isDefault: v.optional(v.boolean())
});

// List bank accounts query schema
export const ListBankAccountsQuerySchema = v.object({
  page: v.optional(v.pipe(v.number(), v.minValue(1))),
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)))
});

// Response schemas
export const BankAccountResponseSchema = v.object({
  id: v.string(),
  userId: v.string(),
  bankName: v.string(),
  accountNumber: v.string(),
  accountName: v.string(),
  isDefault: v.boolean(),
  createdAt: v.date(),
  updatedAt: v.optional(v.date())
});

export const BankAccountListResponseSchema = v.object({
  data: v.array(BankAccountResponseSchema),
  meta: v.object({
    total: v.number(),
    page: v.number(),
    limit: v.number(),
    totalPages: v.number()
  })
});
