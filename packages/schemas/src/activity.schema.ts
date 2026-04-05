import { t } from 'elysia';
import { NullableString, NullableDateString, PaginationSchema } from './common.schema';

export const ActivitySchema = t.Object({
  id: t.String(),
  userId: t.String(),
  action: t.String(),
  target: NullableString,
  metadata: t.Optional(t.Union([t.Record(t.String(), t.Unknown()), t.Null()])),
  createdAt: t.Union([t.String(), t.Date()])
});

export const ActivityListResponseSchema = t.Object({
  success: t.Literal(true),
  data: t.Array(ActivitySchema),
  pagination: PaginationSchema
});

export const RecentActivityResponseSchema = t.Object({
  success: t.Literal(true),
  data: t.Array(ActivitySchema)
});
