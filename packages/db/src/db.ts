import { resolve } from 'path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

// Bun automatically loads .env files - no dotenv needed

const bdUrl = resolve(
  import.meta.dir,
  '..',
  (Bun.env.DATABASE_URL || 'database.sqlite').replace(/^file:/, '')
);

// Log để kiểm tra khi dev (tùy chọn)
if (Bun.env.NODE_ENV !== 'production') {
  console.log(`[DB] Connected to: ${bdUrl}`);
}

// 4. Khởi tạo Bun SQLite và Drizzle
const sqlite = new Database(bdUrl);
export const db = drizzle(sqlite, { schema });
