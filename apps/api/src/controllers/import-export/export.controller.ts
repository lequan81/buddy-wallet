/**
 * Export Controller
 *
 * Thin controller that delegates to ExportService via DI.
 * Handles HTTP concerns (headers, file response) only.
 */
import { Elysia } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, apiResponse } from '@repo/errors';
import { accessControlPlugin, servicesPlugin, sessionAuthPlugin } from '@plugins';
import { getClientIP } from '@utils';
import type { ExportFormat } from '@/types';
import { isFailureResult } from '@/core/http/result-helper';
import { resolveActor } from '@/core/http/response.helpers';

export const ExportController = new Elysia({ prefix: '/export' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(accessControlPlugin)

  // Export user's own debts
  .get('/debts', async ({ user, set, query, request, server, exportService, activityService }) => {
    const resolved = await resolveActor(user, set);
    if (!resolved.ok) return resolved.error;
    const { user: freshUser } = resolved;

    const format = ((query as Record<string, unknown>)?.format || 'xlsx') as ExportFormat;

    if (format === 'csv') {
      await activityService.log({
        userId: freshUser.id,
        action: 'export',
        resource: 'export',
        metadata: { format, filename: `debts_${new Date().toISOString().split('T')[0]}.csv`, mode: 'stream' },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of exportService.streamUserDebtsAsCSV(freshUser.id)) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="debts_${new Date().toISOString().split('T')[0]}.csv"`,
          'Transfer-Encoding': 'chunked'
        }
      });
    }

    const result = await exportService.exportUserDebts(freshUser.id, format);

    if (isFailureResult(result)) {
      set.status = 404;
      return apiResponse({ ok: false, error: BE_ERRORS.EXPORT_NO_DATA });
    }

    await activityService.log({
      userId: freshUser.id,
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
    const resolved = await resolveActor(user, set);
    if (!resolved.ok) return resolved.error;
    const { user: freshUser } = resolved;

    if (freshUser.role !== 'admin') {
      set.status = 403;
      return apiResponse({ 
        ok: false, 
        error: GEN_ERRORS.FORBIDDEN, 
        details: 'Admin access required' 
      });
    }

    const format = ((query as Record<string, unknown>)?.format || 'xlsx') as ExportFormat;

    const result = await exportService.exportAllDebts(format);

    if (isFailureResult(result)) {
      set.status = 404;
      return apiResponse({ ok: false, error: BE_ERRORS.EXPORT_NO_DATA });
    }

    await activityService.log({
      userId: freshUser.id,
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
