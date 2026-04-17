import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import {
  PreviewImportSchema,
  StartImportSchema,
  ProgressSSEQuerySchema,
  ProgressBatchBodySchema,
  LogsQuerySchema
} from '@repo/schema';
import { GEN_ERRORS, apiSuccess, apiError } from '@repo/errors';
import { accessControlPlugin, containerPlugin, sessionAuthPlugin } from '@plugins';
import { logger } from '@repo/logger';
import type { ImportConfig } from '@/types';
import { validateImportUploadFile } from '@/app/Services/import-export/import.validators';
import { parsePagePagination } from '@/core/http/pagination';
import { normalizeImportStatus } from '@/core/http/import-status';
import { isFailureResult } from '@/core/http/result-helper';
import { resolveActor } from '@/core/http/response.helpers';
import { ImportService } from '@/app/Services/ImportService';
import { JobsService } from '@/app/Services/JobsService';

@injectable()
export class ImportController {
  constructor(
    @inject(ImportService) private importService: ImportService,
    @inject(JobsService) private jobsService: JobsService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/import', (group) =>
      group
        .use(containerPlugin)
        .use(sessionAuthPlugin)
        .use(accessControlPlugin)

        // Preview endpoint (Async)
        .post(
          '/preview',
          async ({ user, body, set }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const { file } = body as any;
            const validationError = await validateImportUploadFile(file);
            if (validationError) {
              set.status = validationError.status;
              return validationError.body;
            }

            try {
              const jobId = await this.jobsService.addJob('preview', {
                file,
                userId: freshUser.id
              });

              return apiSuccess({
                jobId,
                message: 'File is being analyzed in background'
              });
            } catch (err) {
              set.status = 503;
              return apiError(GEN_ERRORS.UNKNOWN, String(err));
            }
          },
          {
            body: PreviewImportSchema
          }
        )

        // Import debts endpoint (Async)
        .post(
          '/debts',
          async ({ user, body, set }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const { file, config, previewLogId } = body as any;
            const validationError = await validateImportUploadFile(file);
            if (validationError) {
              set.status = validationError.status;
              return validationError.body;
            }

            try {
              const jobId = await this.jobsService.addJob('import', {
                file,
                config: config as ImportConfig,
                userId: { id: freshUser.id },
                previewLogId
              });

              return apiSuccess({
                jobId,
                message: 'Import started in background'
              });
            } catch (err) {
              logger.error('[Import] Failed to start job', { error: String(err) });
              set.status = 503;
              return apiError(GEN_ERRORS.UNKNOWN, String(err));
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
              user
            } = ctx;

            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;

            const result = await this.importService.getProgress(logId, resolved.user.id);

            if (isFailureResult(result)) {
              set.status = 404;
              return apiError(GEN_ERRORS.NOT_FOUND, result.error);
            }

            return apiSuccess({
              ...result.data,
              status: normalizeImportStatus(result.data.status as any)
            });
          },
          { params: t.Object({ logId: t.String() }) }
        )

        // Get batch import progress (SSE)
        .get(
          '/progress-sse',
          async (ctx) => {
            const { query, user, set, request } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const logIds = query.logIds?.split(',') || [];
            if (logIds.length === 0) {
              return apiError(GEN_ERRORS.INVALID_INPUT, 'logIds required');
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
              start: (controller) => {
                const abortHandler = () => {
                  stopPolling();
                  controller.close();
                };
                request.signal.addEventListener('abort', abortHandler, { once: true });

                interval = setInterval(async () => {
                  try {
                    const result = await this.importService.getProgressBatch(logIds, freshUser.id);
                    if (isFailureResult(result)) throw new Error(result.error);

                    const results = result.data;
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
              set
            } = ctx;

            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;

            const result = await this.importService.getProgressBatch(logIds, resolved.user.id);
            if (isFailureResult(result)) {
              return apiError(GEN_ERRORS.UNKNOWN, result.error);
            }

            const results = result.data;
            for (const key of Object.keys(results)) {
              results[key].status = normalizeImportStatus(results[key].status as any) as any;
            }
            return apiSuccess(results);
          },
          { body: ProgressBatchBodySchema }
        )

        // Get import logs
        .get(
          '/logs',
          async (ctx) => {
            const { user, query, set } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            
            const { page, limit } = parsePagePagination(query);
            const result = await this.importService.getLogs(resolved.user.id, page, limit);

            return apiSuccess(result.data);
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
              params: { id }
            } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;

            const result = await this.importService.getLogById(id, resolved.user.id);
            if (!result) {
              return apiError(GEN_ERRORS.NOT_FOUND, 'Import log not found');
            }

            if (result.status) {
              result.status = normalizeImportStatus(result.status as any) as any || result.status;
            }
            return apiSuccess(result);
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
            } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            
            const result = await this.jobsService.cancelJob(jobId, resolved.user.id);
            if (isFailureResult(result)) {
              set.status = 400;
              return apiError(GEN_ERRORS.INVALID_INPUT, result.error);
            }
            return apiSuccess({ message: 'Job cancelled', jobId });
          },
          { params: t.Object({ jobId: t.String() }) }
        )
    );
  }
}
