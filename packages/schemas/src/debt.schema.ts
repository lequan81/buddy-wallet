import { t } from 'elysia';
import { DEBT_STATUS, DEBT_DIRECTION } from '@repo/config';
import { NullableString, NullableDateString, NullableNumber, PaginationSchema } from './common.schema';

export const DebtStatusSchema = t.Union([
  t.Literal(DEBT_STATUS.PENDING),
  t.Literal(DEBT_STATUS.CONFIRMED),
  t.Literal(DEBT_STATUS.PAID),
  t.Literal(DEBT_STATUS.DISPUTED),
  t.Literal(DEBT_STATUS.CANCELLED)
]);

export const DebtSchema = t.Object({
  id: t.String(),
  debtorPhone: t.String(),
  creditorPhone: t.String(),
  debtorId: NullableString,
  creditorId: NullableString,
  uploadedById: t.String(),
  amount: t.Number(),
  description: NullableString,
  status: DebtStatusSchema,
  confirmedByCreditor: t.Boolean(),
  confirmedByDebtor: t.Boolean(),
  needsConfirmation: t.Boolean(),
  creditorConfirmedAt: NullableDateString,
  debtorConfirmedAt: NullableDateString,
  hasPendingProof: t.Boolean(),
  proofCount: t.Number(),
  lastProofUploadedAt: NullableDateString,
  expiresAt: NullableDateString,
  suggestedAmount: NullableNumber,
  suggestedDescription: NullableString,
  suggestedById: NullableString,
  suggestedAt: NullableDateString,
  createdAt: t.String(),
  updatedAt: t.String(),
  deletedAt: NullableDateString
});

export const DebtListResponseSchema = t.Object({
  success: t.Literal(true),
  debts: t.Array(DebtSchema),
  pagination: PaginationSchema
});

export const RecentDebtSchema = t.Object({
  id: t.String(),
  description: NullableString,
  amount: t.String(),
  phone: t.String(),
  createdAt: t.String()
});

export const RecentDebtsResponseSchema = t.Object({
  success: t.Literal(true),
  debts: t.Array(RecentDebtSchema)
});

export const DebtResponseSchema = t.Object({
  success: t.Literal(true),
  debt: DebtSchema
});

export const RecentContactsResponseSchema = t.Object({
  success: t.Literal(true),
  contacts: t.Array(t.String())
});

export const DeleteAllResponseSchema = t.Object({
  success: t.Literal(true),
  message: t.String(),
  deleted: t.Number()
});

export const DebtQuerySchema = t.Object({
  limit: t.Optional(t.String()),
  offset: t.Optional(t.String()),
  status: t.Optional(t.Union([DebtStatusSchema, t.Literal('all')])),
});

export const CreateDebtSchema = t.Object({
  amount: t.Number({ minimum: 1 }),
  description: t.String({ maxLength: 500 }),
  counterpartyPhone: t.String({ minLength: 9, maxLength: 20 }),
  direction: t.Union([t.Literal(DEBT_DIRECTION.LEND), t.Literal(DEBT_DIRECTION.BORROW)]),
  expiryOption: t.Optional(
    t.Union([t.Literal('never'), t.Literal('7d'), t.Literal('30d'), t.Literal('90d')])
  ),
  confirmDuplicate: t.Optional(t.Boolean())
});

export const UpdateDebtStatusSchema = t.Object({
  status: DebtStatusSchema
});

export const UpdateDebtSchema = t.Object({
  description: t.Optional(t.String({ maxLength: 500 })),
  amount: t.Optional(t.Number({ minimum: 1 }))
});

export const SuggestDebtEditSchema = t.Object({
  amount: t.Optional(t.Number({ minimum: 1 })),
  description: t.Optional(t.String({ maxLength: 500 }))
});

export const DeleteBatchDebtSchema = t.Object({
  ids: t.Array(t.String(), { minItems: 1, maxItems: 50 })
});
