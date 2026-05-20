/**
 * Data/Import-Export Routes
 * @logicType http
 *
 * Import routes require import-capable permissions.
 */

import { Elysia } from 'elysia';
import * as v from 'valibot';
import { ExportDataQuerySchema, ImportDataSchema } from './schema';
import { data } from './handlers/data.handler';
import { dataImport } from './handlers/import.handler';
import { importPreview } from './handlers/preview.handler';
import { progressPoll } from './handlers/progress-poll.handler';
import { requireUser, requirePermission } from '@/commons/http/require-user';
import type { Permission } from '@/commons/security/permissions';

// debt:create is kept as a backward-compatible fallback for existing user rows.
const IMPORT_ACCESS_PERMISSIONS: Permission[] = ['admin:import', 'data:import', 'debt:create'];
const EXPORT_ACCESS_PERMISSIONS: Permission[] = ['admin:view', 'data:export', 'debt:create'];

export const dataRoutes = new Elysia({ prefix: '/data' })
  .get('/export', requirePermission(EXPORT_ACCESS_PERMISSIONS, data.exportData), {
    query: ExportDataQuerySchema,
    detail: { tags: ['data'], description: 'Export data in JSON or CSV format' }
  })
  // Import Preview — accepts file upload, returns preview + suggested mapping
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Elysia handler type incompatibility
  .post('/import/preview', requirePermission(IMPORT_ACCESS_PERMISSIONS, importPreview.preview) as any, {
    detail: { tags: ['data'], description: 'Upload Excel/CSV file for import preview' }
  })
  // Start import from preview — uses stored parsed JSON + column mapping
  .post('/import/:id/start', requirePermission(IMPORT_ACCESS_PERMISSIONS, importPreview.startFromPreview), {
    params: v.object({ id: v.string() }),
    body: v.object({
      columnMapping: v.record(v.string(), v.string()),
      startRow: v.optional(v.pipe(v.number(), v.minValue(1)))
    }),
    detail: { tags: ['data'], description: 'Start import from preview with column mapping' }
  })
  // Retrieve parsed Excel/CSV preview data by import ID
  .get('/import/:id/preview-data', requirePermission(IMPORT_ACCESS_PERMISSIONS, importPreview.getPreviewData), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['data'], description: 'Retrieve parsed Excel/CSV preview data by import ID' }
  })
  .post('/import', requirePermission(IMPORT_ACCESS_PERMISSIONS, dataImport.importData), {
    body: ImportDataSchema,
    detail: { tags: ['data'], description: 'Import debts from JSON data' }
  })
  .get('/import/logs', requireUser(dataImport.getLogs), {
    query: v.object({
      page: v.optional(v.pipe(v.unknown(), v.transform((value) => Number(value)), v.number(), v.minValue(1))),
      limit: v.optional(v.pipe(v.unknown(), v.transform((value) => Number(value)), v.number(), v.minValue(1), v.maxValue(100)))
    }),
    detail: { tags: ['data'], description: 'List import history logs' }
  })
  .post('/import/progress-poll', requireUser(progressPoll.poll), {
    body: v.object({
      logIds: v.array(v.string())
    }),
    detail: { tags: ['data'], description: 'Poll import progress for multiple log IDs' }
  })
  .get('/import/:id/progress', requireUser(dataImport.getProgress), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['data'], description: 'Get import progress by ID' }
  })
  .post('/import/:id/remap', requirePermission(IMPORT_ACCESS_PERMISSIONS, dataImport.remap), {
    params: v.object({ id: v.string() }),
    body: v.object({ columnMapping: v.optional(v.record(v.string(), v.string())) }),
    detail: { tags: ['data'], description: 'Re-map columns for an existing import' }
  });
