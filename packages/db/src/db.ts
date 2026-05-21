import { resolve } from 'path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

// Bun automatically loads .env files - no dotenv needed

// Resolve DATABASE_URL relative to packages/db/ (where .env lives)
// import.meta.dir is packages/db/src, so one '..' gets us to packages/db/
const bdUrl = resolve(
  import.meta.dir,
  '..',
  (Bun.env.DATABASE_URL || '../../data/buddy-wallet.sqlite').replace(/^file:/, '')
);

// Log để kiểm tra khi dev (tùy chọn)
if (Bun.env.NODE_ENV !== 'production') {
  console.log(`[DB] Connected to: ${bdUrl}`);
}

// 4. Khởi tạo Bun SQLite và Drizzle
const sqlite = new Database(bdUrl);

// SQLite performance and safety pragmas
sqlite.exec('PRAGMA journal_mode=WAL');
sqlite.exec('PRAGMA busy_timeout=30000');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec('PRAGMA synchronous=NORMAL');
sqlite.exec('PRAGMA cache_size=-64000'); // 64MB cache
sqlite.exec('PRAGMA temp_store=MEMORY');
sqlite.exec('PRAGMA mmap_size=268435456'); // 256MB memory map

export const db = drizzle(sqlite, { schema });
