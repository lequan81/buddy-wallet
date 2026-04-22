import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import {
  PreviewImportSchema,
  StartImportSchema,
  ProgressSSEQuerySchema,
  ProgressBatchBodySchema,
  LogsQuerySchema
} from '@repo/schema';
import { GEN_ERRORS } from '@repo/errors';
import { actor, accessControl } from '@/app/Providers/Plugins';
import { logger } from '@repo/logger';
import type { ImportConfig } from '@/types';
import { validateImportUploadFile } from '@/lib/validation/import';
import { apiSuccess, apiError, isFailureResult, parsePagePagination, normalizeImportStatus } from '@/lib/http';
import { GetProgressAction } from '@/app/Actions/Data/GetProgressAction';
import { GetProgressBatchAction } from '@/app/Actions/Data/GetProgressBatchAction';
import { GetLogsAction } from '@/app/Actions/Data/GetLogsAction';
import { GetLogByIdAction } from '@/app/Actions/Data/GetLogByIdAction';
import { AddJobAction } from '@/app/Actions/System/AddJobAction';
import { CancelJobAction } from '@/app/Actions/System/CancelJobAction';
import type { AuthenticatedElysiaContext } from '@/types/elysia';

@injectable()
export class ImportController {
  constructor(
    @inject(GetProgressAction) private getProgressAction: GetProgressAction,
    @inject(GetProgressBatchAction) private getProgressBatchAction: GetProgressBatchAction,
    @inject(GetLogsAction) private getLogsAction: GetLogsAction,
    @inject(GetLogByIdAction) private getLogByIdAction: GetLogByIdAction,
    @inject(AddJobAction) private addJobAction: AddJobAction,
    @inject(CancelJobAction) private cancelJobAction: CancelJobAction
  ) { }

  register(app: Elysia): any {
    return app.group('/import', (group) =>
      group
        .use(actor)
        .use(accessControl)
        // @ts-expect-error macro
        .requireActor(true)

        // Preview endpoint (Async)
        .post(
          '/preview',
          async (ctx: any) => {
            const { actor, body, set } = ctx as AuthenticatedElysiaContext<any>;
            const { file } = body;
            const validationError = await validateImportUploadFile(file);
            if (validationError) {
              set.status = validationError.status;
              return validationError.body;
            }

            try {
              const jobId = await this.addJobAction.execute('preview', {
                file,
                userId: actor!.id
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
          async (ctx: any) => {
            const { actor, body, set } = ctx as AuthenticatedElysiaContext<any>;
            const { file, config, previewLogId } = body;
            const validationError = await validateImportUploadFile(file);
            if (validationError) {
              set.status = validationError.status;
              return validationError.body;
            }

            try {
              const jobId = await this.addJobAction.execute('import', {
                file,
                config: config as ImportConfig,
                userId: actor!.id,
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
          async (ctx: any) => {
            const { params: { logId }, actor, set } = ctx as AuthenticatedElysiaContext;
            const result = await this.getProgressAction.execute(logId, actor!.id);

            if (isFailureResult(result)) {
              set.status = 404;
              return apiError(GEN_ERRORS.NOT_FOUND, result.error);
            }

            return apiSuccess({
              ...result.data,
              status: normalizeImportStatus((result as any).data.status)
            });
          },
          { params: t.Object({ logId: t.String() }) }
        )

        // Get batch import progress (SSE)
        .get(
          '/progress-sse',
          async (ctx: any) => {
            const { query, actor, set, request } = ctx as AuthenticatedElysiaContext<any>;
            const logIds = query.logIds?.split(',') || [];
            if (logIds.length === 0) {
              set.status = 400;
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
                    const result = await this.getProgressBatchAction.execute(logIds, actor!.id);
                    if (isFailureResult(result)) throw new Error(result.error);

                    const results = result.data as Record<string, any>;
                    for (const key of Object.keys(results)) {
                      results[key].status = normalizeImportStatus(results[key].status) as any;
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
          async (ctx: any) => {
            const { body: { logIds }, actor, set } = ctx as AuthenticatedElysiaContext<any>;
            const result = await this.getProgressBatchAction.execute(logIds, actor!.id);
            if (isFailureResult(result)) {
              set.status = 500;
              return apiError(GEN_ERRORS.UNKNOWN, result.error);
            }

            const results = result.data as Record<string, any>;
            for (const key of Object.keys(results)) {
              results[key].status = normalizeImportStatus(results[key].status) as any;
            }
            return apiSuccess(results);
          },
          { body: ProgressBatchBodySchema }
        )

        // Get import logs
        .get(
          '/logs',
          async (ctx: any) => {
            const { actor, query } = ctx as AuthenticatedElysiaContext<any>;
            const { page, limit } = parsePagePagination(query);
            const result = await this.getLogsAction.execute(actor!.id, page, limit);

            return apiSuccess(result);
          },
          {
            query: LogsQuerySchema
          }
        )

        // Get single import log by ID
        .get(
          '/logs/:id',
          async (ctx: any) => {
            const { params: { id }, actor, set } = ctx as AuthenticatedElysiaContext;
            const result = await this.getLogByIdAction.execute(id, actor!.id);
            return apiSuccess(result as any);
          },
          { params: t.Object({ id: t.String() }) }
        )

        // Cancel a pending import job
        .delete(
          '/jobs/:jobId',
          async (ctx: any) => {
            const { params: { jobId }, actor, set } = ctx as AuthenticatedElysiaContext;
            const result = await this.cancelJobAction.execute(jobId, actor!.id);
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
