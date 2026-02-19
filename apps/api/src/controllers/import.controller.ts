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
  .use(accessControlPlugin)
  .onBeforeHandle((ctx) => {
    const { user, set } = ctx as typeof ctx & { user: User | null };
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'Authentication required');
    }
  })

  // Preview endpoint
  // Preview endpoint (Async)
  .post(
    '/preview',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      const { file } = body;

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
    { body: t.Object({ file: t.File() }) }
  )

  // Import debts endpoint (Async)
  .post(
    '/debts',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      const { file, config, previewLogId } = body;

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
        console.error('[Import] Failed to start job:', err);
        set.status = 503;
        return errorResponse(GEN_ERRORS.UNKNOWN, String(err));
      }
    },
    {
      body: t.Object({
        file: t.File(),
        // Automatically parse JSON string from FormData and validate against schema
        config: StringToJSON(ImportConfigSchema),
        previewLogId: t.Optional(t.String())
      })
    }
  )

  // Cleanup stale logs (user-specific)
  .use(deleteRateLimiter) // Rate limit: 20 deletes per minute
  .delete('/cleanup', async (ctx) => {
    const { user } = ctx as typeof ctx & { user: User };

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

      const result = await ImportService.getProgress(logId, user.id);

      if (!result.success) {
        set.status = 404;
        return errorResponse(GEN_ERRORS.NOT_FOUND, result.error);
      }

      return successResponse(result);
    },
    { params: t.Object({ logId: t.String() }) }
  )

  // Get batch import progress
  // Reduces 10+ concurrent requests to 1
  .post(
    '/progress-batch',
    async (ctx) => {
      const {
        body: { logIds },
        user
      } = ctx as typeof ctx & { user: User; body: { logIds: string[] } };

      const result = await ImportService.getProgressBatch(logIds, user.id);
      return successResponse(result);
    },
    { body: t.Object({ logIds: t.Array(t.String()) }) }
  )

  // Get import logs
  .get(
    '/logs',
    async (ctx) => {
      const { user, query } = ctx as typeof ctx & { user: User };
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');

      // OPTIMIZATION: Auto-cleanup of stale processing logs (zombies)
      // This ensures the user always sees clean data without needing manual action
      // We run this async without awaiting to not slow down the response
      import('../services/cleanup.service').then(({ CleanupService }) => {
        CleanupService.cleanupStaleProcessingLogs().catch((err) =>
          console.error('[AutoCleanup] Failed to clean stale logs during fetch:', err)
        );
      });

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
  );
