/**
 * Import Controller
 *
 * Thin controller that delegates to ImportService via DI.
 * Handles HTTP concerns (validation, response) only.
 */
import { Elysia, t, type TSchema } from 'elysia';
import { GEN_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { accessControlPlugin } from '../plugins';
import { deleteRateLimiter } from '../plugins/middleware';
import { logger } from '@repo/logger';
import { MAX_IMPORT_FILE_SIZE, ACCEPTED_IMPORT_MIME_TYPES } from '@repo/config';
import { isValidSpreadsheetBytes } from '@repo/utils';
import { servicesPlugin } from '../plugins/services.plugin';
import type { ImportConfig } from '../types';
import type { User } from '@repo/db';



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
  .use(servicesPlugin)
  .use(accessControlPlugin)

  // Preview endpoint
  // Preview endpoint (Async)
  .post(
    '/preview',
    async ({ user, body, set, jobsService }) => {
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
        const jobId = await jobsService.addJob('preview', {
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
    async ({ user, body, set, jobsService }) => {
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
        const jobId = await jobsService.addJob('import', {
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
  .delete('/cleanup', async ({ user, set, importService }) => {
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED);
    }

    // Clean up user's stale pending logs
    await importService.cleanupStaleLogs(user.id);

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
        user,
        importService
      } = ctx as typeof ctx & { user: User };

      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await importService.getProgress(logId, user.id);

      if (!result.success) {
        set.status = 404;
        return errorResponse(GEN_ERRORS.NOT_FOUND, result.error);
      }

      return successResponse(result);
    },
    { params: t.Object({ logId: t.String() }) }
  )


  // Get batch import progress (SSE)
  // Provides real-time updates without polling overhead from client
  .get(
    '/progress-sse',
    async (ctx) => {
      const { query, user, set, importService } = ctx as typeof ctx & { user: User; importService: typeof ImportService };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const logIds = query.logIds?.split(',') || [];
      if (logIds.length === 0) {
        return errorResponse(GEN_ERRORS.INVALID_INPUT, 'logIds required');
      }

      // Set SSE headers for browser/proxy compatibility
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache, no-transform';
      set.headers['Connection'] = 'keep-alive';
      set.headers['X-Accel-Buffering'] = 'no';

      // Use native ReadableStream for SSE - robust and standard compliant
      const stream = new ReadableStream({
        async start(controller) {
          const interval = setInterval(async () => {
            try {
              const results = await importService.getProgressBatch(logIds, user.id);
              
              // Format as SSE data
              controller.enqueue(`data: ${JSON.stringify(results)}\n\n`);

              // If all monitored jobs are terminal, stop streaming
              const allDone = Object.values(results).every(
                (r) => r.status === 'success' || r.status === 'failed'
              );

              if (allDone) {
                clearInterval(interval);
                controller.close();
              }
            } catch (err) {
              logger.error('[Import] SSE stream error', { error: String(err) });
              clearInterval(interval);
              controller.error(err);
            }
          }, 2000);

          // Handle client disconnect to clear interval
          // Bun supports 'close' event on the request/response
        },
        cancel() {
          // This is called when the client disconnects
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    },
    {
      query: t.Object({
        logIds: t.Optional(t.String())
      })
    }
  )

  // Get batch import progress (HTTP)
  // Reduces 10+ concurrent requests to 1
  .post(
    '/progress-batch',
    async (ctx) => {
      const {
        body: { logIds },
        user,
        importService
      } = ctx as typeof ctx & { user: User; body: { logIds: string[] } };

      if (!user) {
        ctx.set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await importService.getProgressBatch(logIds, user.id);
      return successResponse(result);
    },
    { body: t.Object({ logIds: t.Array(t.String()) }) }
  )


  // WebSocket removed — use /progress-batch HTTP endpoint instead
  // (better scalability: no persistent connections, no CPU overhead at scale)


  // Get import logs
  .get(
    '/logs',
    async (ctx) => {
      const { user, query, set, importService } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');

      // Cleanup is handled by 15-minute cron in index.ts

      // Let's call the service method we just added
      const result = await importService.getLogs(user.id, page, limit);

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
        params: { id },
        importService
      } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const result = await importService.getLogById(id, user.id);
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
        set,
        jobsService
      } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const result = await jobsService.cancelJob(jobId, user.id);
      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }
      return successResponse({ message: 'Job cancelled', jobId });
    },
    { params: t.Object({ jobId: t.String() }) }
  );
