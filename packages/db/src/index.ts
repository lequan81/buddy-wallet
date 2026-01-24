import { config } from 'dotenv';
import { resolve } from 'path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

// 2. Nạp .env chính xác từ thư mục gốc của package db
// Điều này giúp tránh việc lấy nhầm .env của các app (web, api) khi chạy runtime
// import.meta.dir là packages/db/src -> đi lên 1 cấp dùng .. là packages/db
config({ path: resolve(import.meta.dir, '..', '.env') });

const bdUrl = resolve(
  import.meta.dir,
  '..',
  (process.env.DATABASE_URL || 'database.sqlite').replace(/^file:/, '')
);

// Log để kiểm tra khi dev (tùy chọn)
if (process.env.NODE_ENV !== 'production') {
  console.log(`[DB] Connected to: ${bdUrl}`);
}

// 4. Khởi tạo Bun SQLite và Drizzle
const sqlite = new Database(bdUrl);
export const db = drizzle(sqlite, { schema });

// Export mọi thứ cần thiết
export * from './schema';
export { eq, sql, and, or, desc, asc, gte, lte, ne, isNull } from 'drizzle-orm';
