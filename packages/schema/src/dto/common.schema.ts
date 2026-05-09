/**
 * Common/shared schema definitions and aliases
 * These provide PascalCase exports for TypeScript compatibility
 */

import * as v from 'valibot';

// Response schemas
export const ErrorResponseSchema = v.object({
  error: v.object({
    code: v.string(),
    message: v.string(),
  }),
});

export const ActivityListResponseSchema = v.object({
  data: v.object({
    items: v.array(v.object({})),
    pagination: v.object({
      page: v.number(),
      limit: v.number(),
      total: v.number(),
    }),
  }),
});

export const RecentActivityResponseSchema = v.object({
  data: v.array(v.object({})),
});

// Bank schemas
export const UpdateBankAccountSchema = v.object({
  isDefault: v.optional(v.boolean()),
  accountName: v.optional(v.string()),
});

// Debt schemas
export const DebtQuerySchema = v.object({
  status: v.optional(v.string()),
  limit: v.optional(v.number()),
  offset: v.optional(v.number()),
});

export const UpdateDebtStatusSchema = v.object({
  status: v.string(),
});

export const UpdateDebtSchema = v.object({
  description: v.optional(v.string()),
  amount: v.optional(v.number()),
});

export const SuggestDebtEditSchema = v.object({
  fieldName: v.string(),
  suggestedValue: v.string(),
});

export const DeleteBatchDebtSchema = v.object({
  ids: v.array(v.string()),
});

export const RecentDebtsResponseSchema = v.object({
  data: v.array(v.object({})),
});

// Pagination schema
export const PaginationQuerySchema = v.object({
  limit: v.optional(v.number()),
  offset: v.optional(v.number()),
  page: v.optional(v.number()),
});

// Profile schema
export const UpdateProfileSchema = v.object({
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  emailNotificationsEnabled: v.optional(v.boolean()),
  pushNotificationsEnabled: v.optional(v.boolean()),
});

// Import schemas
export const PreviewImportSchema = v.object({
  file: v.string(),
});

export const StartImportSchema = v.object({
  fileId: v.string(),
  options: v.optional(v.object({})),
});

export const ProgressSSEQuerySchema = v.object({
  logIds: v.string(),
});

export const ProgressBatchBodySchema = v.object({
  jobIds: v.array(v.string()),
});

export const LogsQuerySchema = v.object({
  page: v.optional(v.number()),
  limit: v.optional(v.number()),
});

// Storage schemas
export const UploadQRSchema = v.object({
  file: v.string(),
});

export const UploadPaymentProofSchema = v.object({
  file: v.string(),
  debtId: v.string(),
});

export const RejectProofSchema = v.object({
  reason: v.optional(v.string()),
});
