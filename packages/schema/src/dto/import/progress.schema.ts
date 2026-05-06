import { Type, type Static } from '@sinclair/typebox';

export const progressSSEQuerySchema = Type.Object({
  logIds: Type.Optional(Type.String())
});

export const progressBatchBodySchema = Type.Object({
  logIds: Type.Array(Type.String())
});

export const logsQuerySchema = Type.Object({
  page: Type.Optional(Type.String()),
  limit: Type.Optional(Type.String())
});

export type ProgressSSEQuery = Static<typeof progressSSEQuerySchema>;
export type ProgressBatchBody = Static<typeof progressBatchBodySchema>;
export type LogsQuery = Static<typeof logsQuerySchema>;
