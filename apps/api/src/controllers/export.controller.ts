/**
 * Export Controller
 *
 * Thin controller that delegates to ExportService.
 * Handles HTTP concerns (headers, file response) only.
 */
import { Elysia } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse } from '@repo/errors';
import { sessionAuthPlugin } from '@plugins/session-auth';
import { accessControlPlugin } from '@plugins/access-control';
import { exportService } from '@/services';
import type { ExportFormat } from '@/types';

export const exportController = new Elysia({ prefix: '/export' })
  .use(sessionAuthPlugin)
  .use(accessControlPlugin)

  // Export user's own debts
  .get('/debts', async ({ user, set, query }) => {
    const format = ((query as any)?.format || 'xlsx') as ExportFormat;

    const result = await exportService.exportUserDebts(user!.id, format);

    if (!result.success) {
      set.status = 404;
      return errorResponse(BE_ERRORS.EXPORT_NO_DATA);
    }

    set.headers['Content-Type'] = result.contentType!;
    set.headers['Content-Disposition'] = `attachment; filename="${result.filename}"`;

    return result.buffer;
  })

  // Admin: Export all debts
  .get('/admin/debts', async ({ user, set, query }) => {
    if (user?.role !== 'admin') {
      set.status = 403;
      return errorResponse(GEN_ERRORS.FORBIDDEN, 'Admin access required');
    }

    const format = ((query as any)?.format || 'xlsx') as ExportFormat;

    const result = await exportService.exportAllDebts(format);

    if (!result.success) {
      set.status = 404;
      return errorResponse(BE_ERRORS.EXPORT_NO_DATA);
    }

    set.headers['Content-Type'] = result.contentType!;
    set.headers['Content-Disposition'] = `attachment; filename="${result.filename}"`;

    return result.buffer;
  });
