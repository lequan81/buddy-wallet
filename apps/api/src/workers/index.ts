/**
 * Worker Entry Point
 *
 * Starts all background workers.
 * Run with: `bun run src/workers/index.ts`
 */
import { startImportWorker } from './import.worker';

startImportWorker();
