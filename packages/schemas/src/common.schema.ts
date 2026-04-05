import { t } from 'elysia';

export const NullableString = t.Union([t.String(), t.Null()]);
export const NullableNumber = t.Union([t.Number(), t.Null()]);
export const NullableDateString = t.Union([t.String(), t.Null()]);

export const ErrorResponseSchema = t.Object({
  success: t.Literal(false),
  error: t.Object({
    code: t.String(),
    message: t.String(),
    details: t.Optional(t.String())
  })
});

export const PaginationSchema = t.Object({
  page: t.Number(),
  limit: t.Number(),
  total: t.Number()
});

export const PaginationQuerySchema = t.Object({
  limit: t.Optional(t.String()),
  offset: t.Optional(t.String())
});
