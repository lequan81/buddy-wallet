/**
 * Import Controller
 *
 * Thin controller that delegates to ImportService via DI.
 * Handles HTTP concerns (validation, response) only.
 */
import { Elysia, t } from 'elysia';
import {
  PreviewImportSchema,
  StartImportSchema,
  ProgressSSEQuerySchema,
  ProgressBatchBodySchema,
  LogsQuerySchema
} from '@repo/schemas';
import { GEN_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { sessionAuthPlugin, accessControlPlugin, servicesPlugin } from '@plugins';
import { deleteRateLimiter } from '@plugins/middleware';
import { logger } from '@repo/logger';
import { configs } from '../../configs';
import { MAX_IMPORT_FILE_SIZE, ACCEPTED_IMPORT_MIME_TYPES } from '@repo/config';
import { isValidSpreadsheetBytes } from '@repo/utils';
import type { ImportConfig } from '@/types';




export const ImportController = new Elysia({ prefix: '/import' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
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
      body: PreviewImportSchema
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
      body: StartImportSchema
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
    const { CleanupService } = await import('../../services/system/cleanup.service');
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
      } = ctx;

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
      const { query, user, set, importService } = ctx;
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
      query: ProgressSSEQuerySchema
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
      } = ctx;

      if (!user) {
        ctx.set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }

      const result = await importService.getProgressBatch(logIds, user.id);
      return successResponse(result);
    },
    { body: ProgressBatchBodySchema }
  )


  // WebSocket removed — use /progress-batch HTTP endpoint instead
  // (better scalability: no persistent connections, no CPU overhead at scale)


  // Get import logs
  .get(
    '/logs',
    async (ctx) => {
      const { user, query, set, importService } = ctx;
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const page = parseInt(query.page || '1');
      const limit = query.limit ? Math.min(parseInt(query.limit), configs.PAGINATION.MAX_LIMIT) : configs.PAGINATION.DEFAULT_LIMIT;

      // Cleanup is handled by 15-minute cron in index.ts

      // Let's call the service method we just added
      const result = await importService.getLogs(user.id, page, limit);

      return successResponse(result);
    },
    {
      query: LogsQuerySchema
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
      } = ctx;
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
      } = ctx;
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
