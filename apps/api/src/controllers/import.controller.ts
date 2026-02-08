/**
 * Import Controller
 *
 * Thin controller that delegates to ImportService.
 * Handles HTTP concerns (validation, response) only.
 */
import { Elysia, t } from 'elysia';
import { BE_ERRORS, GEN_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { accessControlPlugin } from '@plugins';
import { deleteRateLimiter } from '@plugins/middleware';
import { importService } from '@/services';
import type { ImportConfig } from '@/types';
import type { User } from '@repo/db';

// SECURITY: Validation schema for import config
const ImportConfigSchema = t.Object({
  mapping: t.Object({
    name: t.String({ minLength: 1 }),
    amount: t.String({ minLength: 1 }),
    phone: t.Optional(t.String()),
    email: t.Optional(t.String()),
    description: t.Optional(t.String()),
    dueDate: t.Optional(t.String())
  }),
  startRow: t.Number({ minimum: 1 })
});

export const importController = new Elysia({ prefix: '/import' })
  .use(accessControlPlugin)
  .onBeforeHandle((ctx) => {
    const { user, set } = ctx as typeof ctx & { user: User | null };
    if (!user) {
      set.status = 401;
      return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'Authentication required');
    }
  })

  // Preview endpoint
  .post(
    '/preview',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      const { file } = body;

      const result = await importService.previewFile(file, user.id);

      if (!result.success) {
        set.status = 400;
        return errorResponse(BE_ERRORS.IMPORT_INVALID_FORMAT, result.error);
      }

      return successResponse(result);
    },
    { body: t.Object({ file: t.File() }) }
  )

  // Import debts endpoint
  .post(
    '/debts',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      const { file, config: configRaw, previewLogId } = body;

      // SECURITY: Parse and validate JSON config
      let config: ImportConfig;
      try {
        const parsed = JSON.parse(configRaw);

        // Validate against schema
        const validation = ImportConfigSchema.Check(parsed);
        if (!validation) {
          set.status = 400;
          return errorResponse(
            BE_ERRORS.IMPORT_PARSE_ERROR,
            'Invalid config format: missing required fields or invalid types'
          );
        }

        config = parsed as ImportConfig;
      } catch (error) {
        set.status = 400;
        return errorResponse(BE_ERRORS.IMPORT_PARSE_ERROR, 'Invalid JSON format');
      }

      const result = await importService.importDebts(
        file,
        config,
        { id: user.id, phoneNumber: user.phoneNumber },
        previewLogId
      );

      if (!result.success) {
        set.status = result.error?.includes('Empty') ? 400 : 500;
        return errorResponse(BE_ERRORS.IMPORT_PARSE_ERROR, result.error);
      }

      return successResponse({
        imported: result.imported,
        errors: result.errors
      });
    },
    { body: t.Object({ file: t.File(), config: t.String(), previewLogId: t.Optional(t.String()) }) }
  )

  // Cleanup stale logs (user-specific)
  .use(deleteRateLimiter) // Rate limit: 20 deletes per minute
  .delete('/cleanup', async (ctx) => {
    const { user } = ctx as typeof ctx & { user: User };
    await importService.cleanupStaleLogs(user.id);
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

      const result = await importService.getProgress(logId, user.id);

      if (!result.success) {
        set.status = 404;
        return errorResponse(GEN_ERRORS.NOT_FOUND, result.error);
      }

      return successResponse(result);
    },
    { params: t.Object({ logId: t.String() }) }
  );
