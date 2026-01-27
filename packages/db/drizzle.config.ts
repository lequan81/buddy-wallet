// Bun automatically loads .env files
import { defineConfig, type Config } from 'drizzle-kit';

// Database path relative to packages/db (where drizzle-kit runs)
const databasePath = process.env.DATABASE_URL || 'database.sqlite';

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
