/**
 * Export Controller
 *
 * Thin controller that delegates to ExportService via DI.
 * Handles HTTP concerns (headers, file response) only.
 */
import { Elysia } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse } from '@repo/errors';
import { sessionAuthPlugin } from '../plugins/auth';
import { accessControlPlugin } from '../plugins';
import { getClientIP } from '../utils';
import { servicesPlugin } from '../plugins/services.plugin';
import type { ExportFormat } from '../types';

export const ExportController = new Elysia({ prefix: '/export' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(accessControlPlugin)

  // Export user's own debts
  .get('/debts', async ({ user, set, query, request, server, exportService, activityService }) => {
    const format = ((query as Record<string, unknown>)?.format || 'xlsx') as ExportFormat;

    const result = await exportService.exportUserDebts(user!.id, format);

    if (!result.success) {
      set.status = 404;
      return errorResponse(BE_ERRORS.EXPORT_NO_DATA);
    }

    await activityService.log({
      userId: user!.id,
      action: 'export',
      resource: 'export',
      metadata: { format, filename: result.filename },
      ipAddress: getClientIP(request, server) || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    set.headers['Content-Type'] = result.contentType!;
    set.headers['Content-Disposition'] = `attachment; filename="${result.filename}"`;

    return result.buffer;
  })

  // Admin: Export all debts
  .get('/admin/debts', async ({ user, set, query, request, server, exportService, activityService }) => {
    if (user?.role !== 'admin') {
      set.status = 403;
      return errorResponse(GEN_ERRORS.FORBIDDEN, 'Admin access required');
    }

    const format = ((query as Record<string, unknown>)?.format || 'xlsx') as ExportFormat;

    const result = await exportService.exportAllDebts(format);

    if (!result.success) {
      set.status = 404;
      return errorResponse(BE_ERRORS.EXPORT_NO_DATA);
    }

    await activityService.log({
      userId: user.id,
      action: 'export',
      resource: 'export',
      metadata: { format, filename: result.filename, scope: 'admin_all' },
      ipAddress: getClientIP(request, server) || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    set.headers['Content-Type'] = result.contentType!;
    set.headers['Content-Disposition'] = `attachment; filename="${result.filename}"`;

    return result.buffer;
  });
