import { injectable, inject } from 'tsyringe';
import { Elysia } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, apiError } from '@repo/errors';
import { accessControlPlugin, containerPlugin, sessionAuthPlugin } from '@plugins';
import { getClientIP } from '@lib/http/ip';
import type { ExportFormat } from '@/types';
import { resolveActor } from '@/core/http/response.helpers';
import { ExportService } from '@/app/Services/ExportService';
import { ActivityService } from '@/app/Services/ActivityService';

@injectable()
export class ExportController {
  constructor(
    @inject(ExportService) private exportService: ExportService,
    @inject(ActivityService) private activityService: ActivityService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/export', (group) =>
      group
        .use(containerPlugin)
        .use(sessionAuthPlugin)
        .use(accessControlPlugin)

        // Export user's own debts
        .get('/debts', async ({ user, set, query, request, server }) => {
          const resolved = await resolveActor(user, set);
          if (!resolved.ok) return resolved.error;
          const { user: freshUser } = resolved;

          const format = ((query as Record<string, unknown>)?.format || 'xlsx') as ExportFormat;

          const result = await this.exportService.exportUserDebts(freshUser.id, format);

          if (isFailureResult(result)) {
            set.status = 404;
            return apiError(BE_ERRORS.EXPORT_NO_DATA);
          }

          const exportData = result.data;

          await this.activityService.log({
            userId: freshUser.id,
            action: 'export',
            resource: 'export',
            metadata: { format, filename: exportData.filename },
            ipAddress: getClientIP(request, server) || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });

          set.headers['Content-Type'] = exportData.contentType!;
          set.headers['Content-Disposition'] = `attachment; filename="${exportData.filename}"`;

          return exportData.buffer;
        })

        // Admin: Export all debts
        .get('/admin/debts', async ({ user, set, query, request, server }) => {
          const resolved = await resolveActor(user, set);
          if (!resolved.ok) return resolved.error;
          const { user: freshUser } = resolved;

          if (freshUser.role !== 'admin') {
            set.status = 403;
            return apiError(GEN_ERRORS.FORBIDDEN, 'Admin access required');
          }

          const format = ((query as Record<string, unknown>)?.format || 'xlsx') as ExportFormat;

          const result = await this.exportService.exportAllDebts(format);

          if (isFailureResult(result)) {
            set.status = 404;
            return apiError(BE_ERRORS.EXPORT_NO_DATA);
          }

          const adminExportData = result.data;

          await this.activityService.log({
            userId: freshUser.id,
            action: 'export',
            resource: 'export',
            metadata: { format, filename: adminExportData.filename, scope: 'admin_all' },
            ipAddress: getClientIP(request, server) || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });

          set.headers['Content-Type'] = adminExportData.contentType!;
          set.headers['Content-Disposition'] = `attachment; filename="${adminExportData.filename}"`;

          return adminExportData.buffer;
        })
    );
  }
}

function isFailureResult(result: any): result is { code: string; error: string } {
  return result && typeof result === 'object' && 'code' in result;
}
