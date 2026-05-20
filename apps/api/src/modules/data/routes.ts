/**
 * Data/Import-Export Routes
 * @logicType http
 *
 * Import routes require admin:import permission.
 */

import { Elysia } from 'elysia';
import * as v from 'valibot';
import { ExportDataQuerySchema, ImportDataSchema } from './schema';
import { data } from './handlers/data.handler';
import { dataImport } from './handlers/import.handler';
import { importPreview } from './handlers/preview.handler';
import { progressPoll } from './handlers/progress-poll.handler';
import { requireUser, requirePermission } from '@/commons/http/require-user';

export const dataRoutes = new Elysia({ prefix: '/data' })
  .get('/export', requireUser(data.exportData), {
    query: ExportDataQuerySchema,
    detail: { tags: ['data'], description: 'Export data in JSON or CSV format' }
  })
  // Import Preview — accepts file upload, returns preview + suggested mapping
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Elysia handler type incompatibility
  .post('/import/preview', requirePermission('admin:import', importPreview.preview) as any, {
    detail: { tags: ['data'], description: 'Upload Excel/CSV file for import preview' }
  })
  // Start import from preview — uses stored parsed JSON + column mapping
  .post('/import/:id/start', requirePermission('admin:import', importPreview.startFromPreview), {
    params: v.object({ id: v.string() }),
    body: v.object({
      columnMapping: v.record(v.string(), v.string()),
      startRow: v.optional(v.pipe(v.number(), v.minValue(1)))
    }),
    detail: { tags: ['data'], description: 'Start import from preview with column mapping' }
  })
  // Retrieve parsed Excel/CSV preview data by import ID
  .get('/import/:id/preview-data', requirePermission('admin:import', importPreview.getPreviewData), {
    params: v.object({ id: v.string() }),
    detail: { tags: ['data'], description: 'Retrieve parsed Excel/CSV preview data by import ID' }
  })
  .post('/import', requirePermission('admin:import', dataImport.importData), {
    body: ImportDataSchema,
    detail: { tags: ['data'], description: 'Import debts from JSON data' }
  })
  .get('/import/logs', requireUser(dataImport.getLogs), {
    query: v.object({
      page: v.optional(v.pipe(v.number(), v.minValue(1))),
      limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)))
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
  .post('/import/:id/remap', requirePermission('admin:import', dataImport.remap), {
    params: v.object({ id: v.string() }),
    body: v.object({ columnMapping: v.optional(v.record(v.string(), v.string())) }),
    detail: { tags: ['data'], description: 'Re-map columns for an existing import' }
  });
