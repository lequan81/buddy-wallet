/**
 * Data/Import-Export Routes
 * @logicType http
 *
 * Import routes require admin:import permission.
 */

import { Elysia, t } from 'elysia';
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
  .post('/import/preview', requirePermission('admin:import', importPreview.preview) as any, {
    detail: { tags: ['data'], description: 'Upload Excel/CSV file for import preview' }
  })
  // Start import from preview — uses stored parsed JSON + column mapping
  .post('/import/:id/start', requirePermission('admin:import', importPreview.startFromPreview), {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      columnMapping: t.Record(t.String(), t.String()),
      startRow: t.Optional(t.Number({ minimum: 1, default: 1 }))
    }),
    detail: { tags: ['data'], description: 'Start import from preview with column mapping' }
  })
  // Legacy: Import from JSON data directly
  .post('/import', requirePermission('admin:import', dataImport.importData), {
    body: ImportDataSchema,
    detail: { tags: ['data'], description: 'Import debts from JSON data (legacy)' }
  })
  .get('/import/logs', requireUser(dataImport.getLogs), {
    query: t.Object({
      page: t.Optional(t.Number({ minimum: 1, default: 1 })),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 }))
    }),
    detail: { tags: ['data'], description: 'List import history logs' }
  })
  .post('/import/progress-poll', requireUser(progressPoll.poll), {
    body: t.Object({
      logIds: t.Array(t.String())
    }),
    detail: { tags: ['data'], description: 'Poll import progress for multiple log IDs' }
  })
  .get('/import/:id/progress', requireUser(dataImport.getProgress), {
    params: t.Object({ id: t.String() }),
    detail: { tags: ['data'], description: 'Get import progress by ID' }
  })
  .post('/import/:id/remap', requirePermission('admin:import', dataImport.remap), {
    params: t.Object({ id: t.String() }),
    body: t.Object({ columnMapping: t.Optional(t.Record(t.String(), t.String())) }),
    detail: { tags: ['data'], description: 'Re-map columns for an existing import' }
  });
