import { t } from 'elysia';

export const ImageUploadSchema = t.File({
  type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxSize: '4m'
});

export const UploadQRSchema = t.Object({
  file: ImageUploadSchema
});

export const UploadPaymentProofSchema = t.Object({
  file: ImageUploadSchema
});

export const RejectProofSchema = t.Object({
  reason: t.Optional(t.String({ maxLength: 500 }))
});
