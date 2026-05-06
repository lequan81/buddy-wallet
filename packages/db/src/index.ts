// Export everything needed
export * from './schema';
export * from './db';

import { db } from './db';

/**
 * Database client type — accepts both the main db instance and transaction objects.
 * This allows repositories to be used inside db.transaction() callbacks.
 *
 * Uses ReturnType to extract the transaction parameter type from the actual db instance,
 * ensuring perfect type compatibility without manual generic constraints.
 */
type TxParam = Parameters<Parameters<(typeof db)['transaction']>[0]>[0];

export type DbClient = typeof db | TxParam;

export {
  eq,
  sql,
  and,
  or,
  desc,
  asc,
  gte,
  lte,
  lt,
  ne,
  isNull,
  not,
  count,
  inArray,
  type SQL,
  type AnyColumn
} from 'drizzle-orm';
