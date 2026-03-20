/**
 * Import Controller
 *
 * Thin controller that delegates to ImportService.
 * Handles HTTP concerns (validation, response) only.
 */
import { Elysia, t, type TSchema } from 'elysia';
import { GEN_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { accessControlPlugin } from '../plugins';
import { deleteRateLimiter } from '../plugins/middleware';
import { ImportService, JobsService } from '../services';
import { logger } from '@repo/logger';
import { MAX_IMPORT_FILE_SIZE, ACCEPTED_IMPORT_MIME_TYPES } from '@repo/config';
import { isValidSpreadsheetBytes } from '@repo/utils';
import type { ImportConfig } from '../types';
import type { User } from '@repo/db';

interface WsData {
  user?: User;
  interval?: ReturnType<typeof setInterval>;
}

// Helper to parse JSON string to object
// useful for handling multipart/form-data where JSON is sent as string
const StringToJSON = <T extends TSchema>(schema: T) =>
  t.Union([
    // Case 1: Already parsed object (Elysia/Bun might do this automatically)
    schema,
    // Case 2: JSON String (needs parsing)
    t
      .Transform(t.String())
      .Decode((value) => {
        try {
          return JSON.parse(value);
        } catch {
          throw new Error('Invalid JSON format');
        }
      })
      .Encode((value) => JSON.stringify(value))
  ]);

// SECURITY: Validation schema for import config
const ImportConfigSchema = t.Object({
  mapping: t.Object({
    name: t.String({ minLength: 1 }),
    amount: t.String({ minLength: 1 }),
    phone: t.Optional(t.String({ pattern: '^\\d+$' })),
    email: t.Optional(t.String()),
    description: t.Optional(t.String()),
    dueDate: t.Optional(t.String())
  }),
  startRow: t.Number({ minimum: 1 })
});

export const ImportController = new Elysia({ prefix: '/import' })
  .use(accessControlPlugin)

  // Preview endpoint
  // Preview endpoint (Async)
  .post(
    '/preview',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const { file } = body;

      // File validation
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        set.status = 400;
        return errorResponse(
          GEN_ERRORS.INVALID_INPUT,
          `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${MAX_IMPORT_FILE_SIZE / 1024 / 1024}MB`
        );
      }

      if (
        !ACCEPTED_IMPORT_MIME_TYPES.includes(
          file.type as (typeof ACCEPTED_IMPORT_MIME_TYPES)[number]
        )
      ) {
        set.status = 400;
        return errorResponse(
          GEN_ERRORS.INVALID_INPUT,
          `Invalid file type '${file.type}'. Allowed: .xlsx, .xls, .csv`
        );
      }

      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());

      if (!isValidSpreadsheetBytes(header)) {
        set.status = 400;
        return errorResponse(
          GEN_ERRORS.INVALID_INPUT,
          'File content does not match XLSX or CSV format'
        );
      }

      try {
        const jobId = await JobsService.addJob('preview', {
          file,
          userId: user.id
        });

        return successResponse({
          success: true,
          jobId,
          message: 'File is being analyzed in background'
        });
      } catch (err) {
        set.status = 503;
        return errorResponse(GEN_ERRORS.UNKNOWN, String(err));
      }
    },
    {
      body: t.Object({
        file: t.File({
          type: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'application/csv'
          ],
          maxSize: '5m'
        })
      })
    }
  )

  // Import debts endpoint (Async)
  .post(
    '/debts',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const { file, config, previewLogId } = body;

      // File validation
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        set.status = 400;
        return errorResponse(
          GEN_ERRORS.INVALID_INPUT,
          `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${MAX_IMPORT_FILE_SIZE / 1024 / 1024}MB`
        );
      }

      if (
        !ACCEPTED_IMPORT_MIME_TYPES.includes(
          file.type as (typeof ACCEPTED_IMPORT_MIME_TYPES)[number]
        )
      ) {
        set.status = 400;
        return errorResponse(
          GEN_ERRORS.INVALID_INPUT,
          `Invalid file type '${file.type}'. Allowed: .xlsx, .xls, .csv`
        );
      }

      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());

      if (!isValidSpreadsheetBytes(header)) {
        set.status = 400;
        return errorResponse(
          GEN_ERRORS.INVALID_INPUT,
          'File content does not match XLSX or CSV format'
        );
      }

      try {
        const jobId = await JobsService.addJob('import', {
          file,
          config: config as ImportConfig,
          userId: { id: user.id, phoneNumber: user.phoneNumber },
          previewLogId
        });

        return successResponse({
          success: true,
          jobId,
          message: 'Import started in background'
        });
      } catch (err) {
        logger.error('[Import] Failed to start job', { error: String(err) });
        set.status = 503;
        return errorResponse(GEN_ERRORS.UNKNOWN, String(err));
      }
    },
    {
      body: t.Object({
        file: t.File({
          type: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'application/csv'
          ],
          maxSize: '5m'
        }),
        // Automatically parse JSON string from FormData and validate against schema
        config: StringToJSON(ImportConfigSchema),
        previewLogId: t.Optional(t.String())
      })
    }
  )

  // Cleanup stale logs (user-specific)
  .use(deleteRateLimiter) // Rate limit: 20 deletes per minute
  .delete('/cleanup', async (ctx) => {
    const { user, set } = ctx as typeof ctx & { user: User };
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    // Clean up user's stale pending logs
    await ImportService.cleanupStaleLogs(user.id);

    // Also trigger system-wide cleanup of zombie processing logs (safe as it checks >1h)
    // This helps users fix "stuck" jobs without needing admin access
    const { CleanupService } = await import('../services/cleanup.service');
    await CleanupService.cleanupStaleProcessingLogs();

    return successResponse({ message: 'Cleanup completed' });
  })

  // Get import progress
  .get(
    '/progress/:logId',
    async (ctx) => {
      const {
        params: { logId },
        set,
        user
      } = ctx as typeof ctx & { user: User };

      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await ImportService.getProgress(logId, user.id);

      if (!result.success) {
        set.status = 404;
        return errorResponse(GEN_ERRORS.NOT_FOUND, result.error);
      }

      return successResponse(result);
    },
    { params: t.Object({ logId: t.String() }) }
  )

  // Get batch import progress (HTTP)
  // Reduces 10+ concurrent requests to 1
  .post(
    '/progress-batch',
    async (ctx) => {
      const {
        body: { logIds },
        user
      } = ctx as typeof ctx & { user: User; body: { logIds: string[] } };

      if (!user) {
        ctx.set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await ImportService.getProgressBatch(logIds, user.id);
      return successResponse(result);
    },
    { body: t.Object({ logIds: t.Array(t.String()) }) }
  )

  // Get batch import progress (WebSocket)
  .ws('/progress-ws', {
    body: t.Object({ logIds: t.Array(t.String()) }),
    message(ws, { logIds }) {
      const wsData = ws.data as WsData;
      const user = wsData.user;
      if (!user) {
        ws.send({ error: 'Unauthorized' });
        ws.close();
        return;
      }

      // If there's an existing interval, clear it
      if (wsData.interval) {
        clearInterval(wsData.interval);
      }

      // Start polling backend progress and pushing to client
      const interval = setInterval(async () => {
        try {
          const result = await ImportService.getProgressBatch(logIds, user.id);
          ws.send(result);

          // Check if all requested jobs are finished
          if (Object.keys(result).length > 0) {
            const allFinished = Object.values(result).every(
              (job) => job.status === 'success' || job.status === 'failed'
            );

            if (allFinished) {
              clearInterval(interval);
            }
          }
        } catch (error) {
          logger.error('[WS] Progress sync error', { error: String(error) });
        }
      }, 2000);

      wsData.interval = interval;
    },
    close(ws) {
      const wsData = ws.data as WsData;
      if (wsData.interval) {
        clearInterval(wsData.interval);
      }
    }
  })

  // Get import logs
  .get(
    '/logs',
    async (ctx) => {
      const { user, query, set } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');

      // Cleanup is handled by 15-minute cron in index.ts

      // Let's call the service method we just added
      const result = await ImportService.getLogs(user.id, page, limit);

      return successResponse(result);
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String())
      })
    }
  )

  // Get single import log by ID
  .get(
    '/logs/:id',
    async (ctx) => {
      const {
        user,
        set,
        params: { id }
      } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const result = await ImportService.getLogById(id, user.id);
      if (!result) {
        return errorResponse(GEN_ERRORS.NOT_FOUND, 'Import log not found');
      }
      return successResponse(result);
    },
    { params: t.Object({ id: t.String() }) }
  )

  // Cancel a pending import job
  .delete(
    '/jobs/:jobId',
    async (ctx) => {
      const {
        user,
        params: { jobId },
        set
      } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const result = await JobsService.cancelJob(jobId, user.id);
      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }
      return successResponse({ message: 'Job cancelled', jobId });
    },
    { params: t.Object({ jobId: t.String() }) }
  );
