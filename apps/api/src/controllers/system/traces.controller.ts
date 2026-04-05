/**
 * Trace Viewer Controller
 * Provides a simple UI to view recent traces at /traces
 * Only available in development mode
 */

import { Elysia } from 'elysia';
import { traceStore } from '@utils/trace-store';
import { configs } from '@/configs';

const isDev = configs.APP.IS_DEV;

// Load HTML template at startup (Bun native file reading)
const templatePath = new URL('../../static/traces.html', import.meta.url).pathname;
let htmlTemplate: string;

try {
  htmlTemplate = await Bun.file(templatePath).text();
} catch {
  // Fallback for Windows path handling
  const winPath = templatePath.startsWith('/') ? templatePath.slice(1) : templatePath;
  htmlTemplate = await Bun.file(winPath).text();
}

/**
 * Render trace viewer HTML with current data
 */
function renderTraceViewer(): string {
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

  return htmlTemplate
    .replace('{{TOTAL}}', String(stats.total))
    .replace('{{ERRORS}}', String(stats.errors))
    .replace('{{ERROR_COLOR}}', stats.errors > 0 ? '#f85149' : '#3fb950')
    .replace('{{AVG_DURATION}}', stats.avgDuration)
    .replace('{{TRACE_ROWS}}', traceRows);
}

export const TracesController = new Elysia({ name: 'TracesController' })
  .get('/traces', () => {
    if (!isDev) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response(renderTraceViewer(), {
      headers: { 'Content-Type': 'text/html' }
    });
  })
  .get('/traces/json', () => {
    if (!isDev) {
      return { error: 'Not available in production' };
    }
    return {
      stats: traceStore.stats(),
      traces: traceStore.getAll()
    };
  })
  .post('/traces/clear', () => {
    if (!isDev) {
      return { error: 'Not available in production' };
    }
    traceStore.clear();
    return { success: true, message: 'Traces cleared' };
  });
