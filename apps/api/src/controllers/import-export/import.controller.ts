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
import { accessControlPlugin, servicesPlugin, sessionAuthPlugin } from '@plugins';
import { logger } from '@repo/logger';
import type { ImportConfig } from '@/types';
import { validateImportUploadFile } from './import-file.utils';
import { requireAuth } from '@/core/http/require-auth';
import { parsePagePagination } from '@/core/http/pagination';
import { normalizeImportStatus } from '@/core/http/import-status';




export const ImportController = new Elysia({ prefix: '/import' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(accessControlPlugin)

  // Preview endpoint
  // Preview endpoint (Async)
  .post(
    '/preview',
    async ({ user, body, set, jobsService }) => {
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const { file } = body;
      const validationError = await validateImportUploadFile(file);
      if (validationError) {
        set.status = validationError.status;
        return validationError.body;
      }

      try {
        const jobId = await jobsService.addJob('preview', {
          file,
          userId: auth.user.id
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
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const { file, config, previewLogId } = body;
      const validationError = await validateImportUploadFile(file);
      if (validationError) {
        set.status = validationError.status;
        return validationError.body;
      }

      try {
        const jobId = await jobsService.addJob('import', {
          file,
          config: config as ImportConfig,
          userId: { id: auth.user.id, phoneNumber: auth.user.phoneNumber },
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

      return successResponse({
        ...result,
        status: normalizeImportStatus(result.status)
      });
    },
    { params: t.Object({ logId: t.String() }) }
  )


  // Get batch import progress (SSE)
  // Provides real-time updates without polling overhead from client
  .get(
    '/progress-sse',
    async (ctx) => {
      const { query, user, set, importService } = ctx;
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
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
      let interval: ReturnType<typeof setInterval> | null = null;
      const stream = new ReadableStream({
        async start(controller) {
          interval = setInterval(async () => {
            try {
              const results = await importService.getProgressBatch(logIds, auth.user.id);

              for (const key of Object.keys(results)) {
                results[key].status = normalizeImportStatus(results[key].status);
              }
              
              // Format as SSE data
              controller.enqueue(`data: ${JSON.stringify(results)}\n\n`);

              // If all monitored jobs are terminal, stop streaming
              const allDone = Object.values(results).every(
                (r) => r.status === 'success' || r.status === 'failed' || r.status === 'cancelled'
              );

              if (allDone) {
                if (interval) clearInterval(interval);
                controller.close();
              }
            } catch (err) {
              logger.error('[Import] SSE stream error', { error: String(err) });
              if (interval) clearInterval(interval);
              controller.error(err);
            }
          }, 2000);

          // Handle client disconnect to clear interval
          // Bun supports 'close' event on the request/response
        },
        cancel() {
          // This is called when the client disconnects
          if (interval) clearInterval(interval);
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
      for (const key of Object.keys(result)) {
        result[key].status = normalizeImportStatus(result[key].status);
      }
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
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const { page, limit } = parsePagePagination(query);

      // Import log lifecycle is handled by worker-side operational scripts.

      // Let's call the service method we just added
      const result = await importService.getLogs(auth.user.id, page, limit);

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
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const result = await importService.getLogById(id, auth.user.id);
      if (!result) {
        return errorResponse(GEN_ERRORS.NOT_FOUND, 'Import log not found');
      }

      if (result.status) {
        result.status = normalizeImportStatus(result.status);
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
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const result = await jobsService.cancelJob(jobId, auth.user.id);
      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }
      return successResponse({ message: 'Job cancelled', jobId });
    },
    { params: t.Object({ jobId: t.String() }) }
  );
