import { Elysia } from 'elysia';
import { system } from './handlers/system.handler';
import { traceStore } from '@/providers/telemetry';

/**
 * Health & Observability Routes
 * Registered directly for absolute stability and bypass of trailing slash issues
 */
export const healthRoutes = new Elysia()
  .get('/health', async ({ set }) => {
    const filePath = `${import.meta.dir}/../../static/health.html`;
    const file = Bun.file(filePath);
    if (await file.exists()) {
      set.headers['content-type'] = 'text/html; charset=utf-8';
      return file;
    }
    set.status = 404;
    return { error: 'Health dashboard HTML not found' };
  }, {
    detail: {
      tags: ['health'],
      description: 'Visual telemetry dashboard (HTML)'
    }
  })
  .get('/health/json', system.healthCheck, {
    detail: {
      tags: ['health'],
      description: 'Liveness & dependency status check telemetry metrics (JSON)'
    }
  });

/**
 * Developer Diagnostics & Tracing Routes
 * All endpoints are registered directly (Decoupled from health for security and isolation)
 */
export const debugRoutes = new Elysia()
  .get('/debug/tracer', async ({ set }) => {
    const filePath = `${import.meta.dir}/../../static/tracer.html`;
    const file = Bun.file(filePath);
    if (await file.exists()) {
      let html = await file.text();
      const stats = traceStore.stats();
      const traces = traceStore.getAll().slice(-200).reverse();

      const rows = traces.map(t => {
        const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : new Date(t.startTime).toLocaleTimeString();
        const methodStr = t.method || 'REQ';
        const pathStr = t.path || t.name;

        let statusValue: string | number = '';
        if (t.attributes) {
          statusValue = (t.attributes['http.status_code'] as number | undefined) ||
                        (t.attributes['http.Response.status_code'] as number | undefined) ||
                        '';
        }

        const durationStr = t.duration ? `${t.duration.toFixed(2)}ms` : '0ms';
        const traceIdStr = t.traceId;

        const statusNum = Number(statusValue);
        let statusClass = 'ok';
        if (t.status === 'error' || (!isNaN(statusNum) && statusNum >= 400)) {
          statusClass = 'err';
        } else if (!isNaN(statusNum) && statusNum >= 300 && statusNum < 400) {
          statusClass = 'warn';
        }

        return `<tr>
          <td>${timeStr}</td>
          <td>${methodStr}</td>
          <td>${pathStr}</td>
          <td class="${statusClass}">${statusValue || t.status || 'unknown'}</td>
          <td>${durationStr}</td>
          <td><a href="/debug/traces/json">${traceIdStr}</a></td>
        </tr>`;
      }).join('\n');

      html = html
        .replace('{{TOTAL}}', String(stats.total))
        .replace('{{ERRORS}}', String(stats.errors))
        .replace('{{AVG_DURATION}}', String(stats.avgDuration))
        .replace('{{TRACE_ROWS}}', rows);

      set.headers['content-type'] = 'text/html; charset=utf-8';
      return html;
    }
    set.status = 404;
    return { error: 'Tracer HTML not found' };
  }, {
    detail: {
      tags: ['debug'],
      description: 'Developer tracer visual tool (HTML)'
    }
  })
  .get('/debug/traces/json', system.debugTracesJson, {
    detail: {
      tags: ['debug'],
      description: 'Raw query and execution traces (JSON)'
    }
  })
  .post('/debug/traces/clear', system.clearTraces, {
    detail: {
      tags: ['debug'],
      description: 'Clear the trace store logs'
    }
  });



