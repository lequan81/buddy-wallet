import { injectable, inject } from 'tsyringe';
import { Elysia } from 'elysia';
import { GEN_ERRORS, BE_ERRORS } from '@repo/errors';
import { actor, accessControl } from '@/app/Providers/Plugins';
import { getClientIP } from '@/lib/http/ip';
import type { ExportFormat } from '@/types';
import { isFailureResult, apiError } from '@/lib/http';
import { ExportUserDebtsAction } from '@/app/Actions/Data/ExportUserDebtsAction';
import { ExportAllDebtsAction } from '@/app/Actions/Data/ExportAllDebtsAction';
import { LogAction } from '@/app/Actions/System/LogAction';
import type { AuthenticatedElysiaContext } from '@/types/elysia';

@injectable()
export class ExportController {
  constructor(
    @inject(ExportUserDebtsAction) private exportUserDebtsAction: ExportUserDebtsAction,
    @inject(ExportAllDebtsAction) private exportAllDebtsAction: ExportAllDebtsAction,
    @inject(LogAction) private logAction: LogAction
  ) {}

  register(app: Elysia): any {
    return app.group('/export', (group: any) =>
      group
        .use(actor)
        .use(accessControl)
        .requireActor(true)

        // Export user's own debts
        .get('/debts', async (ctx: any) => {
          const { actor, set, query, request, server } = ctx as AuthenticatedElysiaContext<any>;
          const format = ((query as Record<string, unknown>)?.format || 'xlsx') as ExportFormat;

          const result = await this.exportUserDebtsAction.execute(actor!.id, format);

          if (isFailureResult(result)) {
            set.status = 404;
            return apiError(BE_ERRORS.EXPORT_NO_DATA);
          }

          const exportData = result.data;

          await this.logAction.execute({
            userId: actor!.id,
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
        .get('/admin/debts', async (ctx: any) => {
          const { actor, set, query, request, server } = ctx as AuthenticatedElysiaContext<any>;
          if ((actor as any).role !== 'admin') {
            set.status = 403;
            return apiError(GEN_ERRORS.FORBIDDEN, 'Admin access required');
          }

          const format = ((query as Record<string, unknown>)?.format || 'xlsx') as ExportFormat;

          const result = await this.exportAllDebtsAction.execute(format);

          if (isFailureResult(result)) {
            set.status = 404;
            return apiError(BE_ERRORS.EXPORT_NO_DATA);
          }

          const adminExportData = result.data;

          await this.logAction.execute({
            userId: actor!.id,
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
