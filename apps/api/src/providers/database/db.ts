/**
 * Database Provider
 * 
 * Exports the Drizzle-ORM instance for database operations.
 * In ElysiaJS FP, we export the instance directly without DI container.
 */

// eslint-disable-next-line no-restricted-imports
import { db } from '@repo/db';

export { db };
