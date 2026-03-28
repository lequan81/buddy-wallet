import { t } from 'elysia';

export const UpdateBankAccountSchema = t.Object({
  bankCode: t.Optional(t.String()),
  bankName: t.Optional(t.String()),
  bankBin: t.Optional(t.String()),
  accountNumber: t.Optional(t.String()),
  accountName: t.Optional(t.String()),
  isDefault: t.Optional(t.Boolean())
});
