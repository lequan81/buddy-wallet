import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const outboxEvents = sqliteTable(
  'outbox_events',
  {
    id: text('id', { length: 24 }).primaryKey(),
    eventType: text('event_type').notNull(),
    aggregateType: text('aggregate_type'),
    aggregateId: text('aggregate_id'),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    status: text('status').$type<'pending' | 'processing' | 'published' | 'failed'>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(10),
    availableAt: integer('available_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    processedAt: integer('processed_at', { mode: 'timestamp' }),
    lastError: text('last_error'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [
    index('idx_outbox_status_available_at').on(table.status, table.availableAt, table.createdAt),
    index('idx_outbox_aggregate').on(table.aggregateType, table.aggregateId),
    index('idx_outbox_event_type').on(table.eventType)
  ]
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
