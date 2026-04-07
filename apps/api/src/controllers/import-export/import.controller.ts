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
import { GEN_ERRORS, apiResponse } from '@repo/errors';
import { accessControlPlugin, servicesPlugin, sessionAuthPlugin } from '@plugins';
import { logger } from '@repo/logger';
import type { ImportConfig } from '@/types';
import { validateImportUploadFile } from '@/services/import-export/import.validators';
import { parsePagePagination } from '@/core/http/pagination';
import { normalizeImportStatus } from '@/core/http/import-status';
import { isFailureResult } from '@/core/http/result-helper';
import { resolveActor } from '@/core/http/response.helpers';

export const ImportController = new Elysia({ prefix: '/import' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(accessControlPlugin)

  // Preview endpoint (Async)
  .post(
    '/preview',
    async ({ user, body, set, jobsService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const { file } = body;
      const validationError = await validateImportUploadFile(file);
      if (validationError) {
        set.status = validationError.status;
        return validationError.body;
      }

      try {
        const jobId = await jobsService.addJob('preview', {
          file,
          userId: freshUser.id
        });

        return apiResponse({
          ok: true,
          data: {
          jobId,
          message: 'File is being analyzed in background'
        }});
      } catch (err) {
        set.status = 503;
        return apiResponse({ ok: false, error: GEN_ERRORS.UNKNOWN, details: String(err) });
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
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

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
          userId: { id: freshUser.id },
          previewLogId
        });

        return apiResponse({
          ok: true,
          data: {
          jobId,
          message: 'Import started in background'
        }});
      } catch (err) {
        logger.error('[Import] Failed to start job', { error: String(err) });
        set.status = 503;
        return apiResponse({ ok: false, error: GEN_ERRORS.UNKNOWN, details: String(err) });
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

      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;

      const result = await importService.getProgress(logId, resolved.user.id);

      if (isFailureResult(result)) {
        set.status = 404;
        return apiResponse({ ok: false, error: GEN_ERRORS.NOT_FOUND, details: result.error });
      }

      return apiResponse({
        ok: true,
        data: {
          ...result,
          status: normalizeImportStatus(result.status as any)
        }
      });
    },
    { params: t.Object({ logId: t.String() }) }
  )

  // Get batch import progress (SSE)
  .get(
    '/progress-sse',
    async (ctx) => {
      const { query, user, set, importService, request } = ctx;
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const logIds = query.logIds?.split(',') || [];
      if (logIds.length === 0) {
        return apiResponse({ ok: false, error: GEN_ERRORS.INVALID_INPUT, details: 'logIds required' });
      }

      // SSE headers
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache, no-transform';
      set.headers['Connection'] = 'keep-alive';
      set.headers['X-Accel-Buffering'] = 'no';

      let interval: ReturnType<typeof setInterval> | null = null;
      const stopPolling = () => {
        if (interval !== null) {
          clearInterval(interval);
          interval = null;
        }
      };

      const stream = new ReadableStream({
        async start(controller) {
          const abortHandler = () => {
            stopPolling();
            controller.close();
          };
          request.signal.addEventListener('abort', abortHandler, { once: true });

          interval = setInterval(async () => {
            try {
              const results = await importService.getProgressBatch(logIds, freshUser.id);

              for (const key of Object.keys(results)) {
                results[key].status = normalizeImportStatus(results[key].status as any) as any;
              }

              controller.enqueue(`data: ${JSON.stringify(results)}\n\n`);

              const allDone = Object.values(results).every(
                (r) => r.status === 'success' || r.status === 'failed' || r.status === 'cancelled'
              );

              if (allDone) {
                stopPolling();
                controller.close();
                request.signal.removeEventListener('abort', abortHandler);
              }
            } catch (err) {
              logger.error('[Import] SSE stream error', { error: String(err) });
              stopPolling();
              controller.error(err);
              request.signal.removeEventListener('abort', abortHandler);
            }
          }, 2000);
        },
        cancel() {
          stopPolling();
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
  .post(
    '/progress-batch',
    async (ctx) => {
      const {
        body: { logIds },
        user,
        set,
        importService
      } = ctx;

      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;

      const result = await importService.getProgressBatch(logIds, resolved.user.id);
      for (const key of Object.keys(result)) {
        result[key].status = normalizeImportStatus(result[key].status as any) as any;
      }
      return apiResponse({ ok: true, data: result });
    },
    { body: ProgressBatchBodySchema }
  )

  // Get import logs
  .get(
    '/logs',
    async (ctx) => {
      const { user, query, set, importService } = ctx;
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      
      const { page, limit } = parsePagePagination(query);
      const result = await importService.getLogs(resolved.user.id, page, limit);

      return apiResponse({ ok: true, data: result });
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
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;

      const result = await importService.getLogById(id, resolved.user.id);
      if (!result) {
        return apiResponse({ ok: false, error: GEN_ERRORS.NOT_FOUND, details: 'Import log not found' });
      }

      if (result.status) {
        result.status = normalizeImportStatus(result.status as any) as any || result.status;
      }
      return apiResponse({ ok: true, data: result });
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
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      
      const result = await jobsService.cancelJob(jobId, resolved.user.id);
      if (isFailureResult(result)) {
        set.status = 400;
        return apiResponse({ ok: false, error: GEN_ERRORS.INVALID_INPUT, details: result.error });
      }
      return apiResponse({ ok: true, data: { message: 'Job cancelled', jobId } });
    },
    { params: t.Object({ jobId: t.String() }) }
  );
