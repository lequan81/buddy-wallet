import { Elysia } from 'elysia';
import { injectable } from 'tsyringe';
import { traceStore } from '@/app/Providers/Plugins/Infrastructure/Telemetry/trace-store';
import { configs } from '@/config';
import { apiSuccess, apiError } from '@/lib/http';
import { GEN_ERRORS } from '@repo/errors';

/**
 * System Controller
 * Handles system-level operations like trace viewing and health checks.
 */
@injectable()
export class SystemController {
  private isDev = !configs.APP.IS_PRODUCTION;
  private templatePath = new URL('../../static/traces.html', import.meta.url).pathname;
  private htmlTemplate: string = '';

  constructor() {
    this.loadTemplate();
  }

  private async loadTemplate() {
    try {
      this.htmlTemplate = await Bun.file(this.templatePath).text();
    } catch {
      // Fallback for Windows path handling
      const winPath = this.templatePath.startsWith('/') ? this.templatePath.slice(1) : this.templatePath;
      this.htmlTemplate = await Bun.file(winPath).text();
    }
  }

  private renderTraceViewer(): string {
    const traces = traceStore.getAll();
    const stats = traceStore.stats();

    const traceRows =
      traces.length > 0
        ? traces
            .map((t) => {
              const statusClass = t.status && t.status >= 400 ? 'error' : 'success';
              const method = t.method || 'SPAN';
              const path = t.path || t.name;
              return `
            <tr class="${statusClass}">
              <td class="time">${t.timestamp.toISOString().slice(11, 23)}</td>
              <td class="method">${method}</td>
              <td class="path">${path}</td>
              <td class="status">${t.status || '-'}</td>
              <td class="duration">${t.duration.toFixed(1)}ms</td>
              <td class="trace-id" title="${t.traceId}">${t.traceId.slice(0, 8)}...</td>
            </tr>
          `;
            })
            .join('')
        : '<tr><td colspan="6" class="empty">No traces yet. Make some requests!</td></tr>';

    return this.htmlTemplate
      .replace('{{TOTAL}}', String(stats.total))
      .replace('{{ERRORS}}', String(stats.errors))
      .replace('{{ERROR_COLOR}}', stats.errors > 0 ? '#f85149' : '#3fb950')
      .replace('{{AVG_DURATION}}', stats.avgDuration)
      .replace('{{TRACE_ROWS}}', traceRows);
  }

  register(app: Elysia): any {
    return app.group('/system', (group) =>
      group
        .get('/traces', () => {
          if (!this.isDev) {
            return new Response('Not Found', { status: 404 });
          }
          return new Response(this.renderTraceViewer(), {
            headers: { 'Content-Type': 'text/html' }
          });
        })
        .get('/traces/json', () => {
          if (!this.isDev) {
            return apiError(GEN_ERRORS.FORBIDDEN, 'Not available in production');
          }
          return apiSuccess({
            stats: traceStore.stats(),
            traces: traceStore.getAll()
          });
        })
        .post('/traces/clear', () => {
          if (!this.isDev) {
            return apiError(GEN_ERRORS.FORBIDDEN, 'Not available in production');
          }
          traceStore.clear();
          return apiSuccess({ message: 'Traces cleared' });
        })
    );
  }
}
