/**
 * Common/shared schema definitions and aliases
 * These provide PascalCase exports for TypeScript compatibility
 */

import { Type, type Static } from '@sinclair/typebox';

// Response schemas
export const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String()
  })
});

export const ActivityListResponseSchema = Type.Object({
  data: Type.Object({
    items: Type.Array(Type.Object({})),
    pagination: Type.Object({
      page: Type.Number(),
      limit: Type.Number(),
      total: Type.Number()
    })
  })
});

export const RecentActivityResponseSchema = Type.Object({
  data: Type.Array(Type.Object({}))
});

// Bank schemas
export const UpdateBankAccountSchema = Type.Object({
  isDefault: Type.Optional(Type.Boolean()),
  accountName: Type.Optional(Type.String())
});

// Debt schemas
export const DebtQuerySchema = Type.Object({
  status: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  offset: Type.Optional(Type.Number())
});

export const UpdateDebtStatusSchema = Type.Object({
  status: Type.String()
});

export const UpdateDebtSchema = Type.Object({
  description: Type.Optional(Type.String()),
  amount: Type.Optional(Type.Number())
});

export const SuggestDebtEditSchema = Type.Object({
  fieldName: Type.String(),
  suggestedValue: Type.String()
});

export const DeleteBatchDebtSchema = Type.Object({
  ids: Type.Array(Type.String())
});

export const RecentDebtsResponseSchema = Type.Object({
  data: Type.Array(Type.Object({}))
});

// Pagination schema
export const PaginationQuerySchema = Type.Object({
  limit: Type.Optional(Type.Number()),
  offset: Type.Optional(Type.Number()),
  page: Type.Optional(Type.Number())
});

// Profile schema
export const UpdateProfileSchema = Type.Object({
  name: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  phoneNumber: Type.Optional(Type.String()),
  emailNotificationsEnabled: Type.Optional(Type.Boolean()),
  pushNotificationsEnabled: Type.Optional(Type.Boolean())
});

// Import schemas
export const PreviewImportSchema = Type.Object({
  file: Type.String()
});

export const StartImportSchema = Type.Object({
  fileId: Type.String(),
  options: Type.Optional(Type.Object({}))
});

export const ProgressSSEQuerySchema = Type.Object({
  logIds: Type.String()
});

export const ProgressBatchBodySchema = Type.Object({
  jobIds: Type.Array(Type.String())
});

export const LogsQuerySchema = Type.Object({
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number())
});

// Storage schemas
export const UploadQRSchema = Type.Object({
  file: Type.String()
});

export const UploadPaymentProofSchema = Type.Object({
  file: Type.String(),
  debtId: Type.String()
});

export const RejectProofSchema = Type.Object({
  reason: Type.Optional(Type.String())
});
