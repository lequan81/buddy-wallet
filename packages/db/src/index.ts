// Export mọi thứ cần thiết
export * from './schema';
export * from './db';

import { type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

export type DbClient = BunSQLiteDatabase<typeof schema>;

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
  inArray
} from 'drizzle-orm';
