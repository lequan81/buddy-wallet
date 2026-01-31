/**
 * Import Controller
 *
 * Thin controller that delegates to ImportService.
 * Handles HTTP concerns (validation, response) only.
 */
import { Elysia, t } from 'elysia';
import { BE_ERRORS, GEN_ERRORS, createError } from '@repo/errors';
import { accessControlPlugin } from '@plugins/access-control';
import { importService } from '@/services';
import type { ImportConfig } from '@/types';
import type { User } from '@repo/db';

export const importController = new Elysia({ prefix: '/import' })
  .use(accessControlPlugin)
  .onBeforeHandle((ctx) => {
    const { user, set } = ctx as typeof ctx & { user: User | null };
    if (!user) {
      set.status = 401;
      return createError(GEN_ERRORS.UNAUTHORIZED, 'Authentication required');
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
        return createError(BE_ERRORS.IMPORT_INVALID_FORMAT, result.error);
      }

      console.log(`[Import] Preview: ${file.name}, ${result.totalRows} rows`);

      return result;
    },
    { body: t.Object({ file: t.File() }) }
  )

  // Import debts endpoint
  .post(
    '/debts',
    async (ctx) => {
      const { user, body, set } = ctx as typeof ctx & { user: User };
      const { file, config: configRaw, previewLogId } = body;

      let config: ImportConfig;
      try {
        config = JSON.parse(configRaw);
      } catch {
        set.status = 400;
        return createError(BE_ERRORS.IMPORT_PARSE_ERROR, 'Invalid config format');
      }

      const result = await importService.importDebts(
        file,
        config,
        { id: user.id, phoneNumber: user.phoneNumber },
        previewLogId
      );

      if (!result.success) {
        set.status = result.error?.includes('Empty') ? 400 : 500;
        return createError(BE_ERRORS.IMPORT_PARSE_ERROR, result.error);
      }

      console.log(
        `[Import] Done: ${result.imported} records, ${result.errors?.length || 0} errors`
      );

      return result;
    },
    { body: t.Object({ file: t.File(), config: t.String(), previewLogId: t.Optional(t.String()) }) }
  )

  // Cleanup stale logs
  .delete('/cleanup', async (ctx) => {
    const { user } = ctx as typeof ctx & { user: User };
    await importService.cleanupStaleLogs();
    console.log(`[Import] Cleaned up stale pending logs`);
    return { success: true, message: 'Stale pending logs cleaned up' };
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
        return result;
      }

      return result;
    },
    { params: t.Object({ logId: t.String() }) }
  );
