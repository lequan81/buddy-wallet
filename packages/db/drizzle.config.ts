import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Config } from 'drizzle-kit';

// __dirname equivalent for ESM (drizzle-kit runs via Node, not Bun)
const __dirname = dirname(fileURLToPath(import.meta.url));

// Database path: use DATABASE_URL env var if set, otherwise default to data/ folder
// Resolve relative to this config file (packages/db/)
const databasePath = process.env.DATABASE_URL
  ? resolve(__dirname, process.env.DATABASE_URL)
  : resolve(__dirname, '../../data/buddy-wallet.sqlite');

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: databasePath
  }
}) satisfies Config;
