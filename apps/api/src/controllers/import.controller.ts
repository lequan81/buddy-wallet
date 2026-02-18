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
    await ImportService.cleanupStaleLogs(user.id);
    return successResponse({ message: 'Stale pending logs cleaned up' });
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

  // Get import logs
  .get(
    '/logs',
    async (ctx) => {
      const { user, query } = ctx as typeof ctx & { user: User };
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');

      // Note: We need to implement getLogs in ImportService first (done in previous step)
      // We will perform a quick hack: sort in-memory in service since we modified it.
      // Ideally we'd fix the imports to use desc().

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
