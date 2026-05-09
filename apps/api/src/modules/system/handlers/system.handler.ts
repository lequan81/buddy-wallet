/**
 * System handlers.
 * @logicType http
 */

import { file } from 'bun';
import { configs } from '@/config';
import { traceStore } from '@/providers/telemetry';
import {
  checkDatabaseHealth,
  checkRedisHealth,
  checkStorageHealth,
  getUptime,
  getSystemInfo,
  determineHealthStatus
} from '../services/system.service';
import { apiSuccess } from '@/commons/http/response';
import type { SystemContext } from '../types/handler.types';

function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key) => data[key] || '');
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function getHealthPayload() {
  const [database, redis, storage] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkStorageHealth()
  ]);

  const services = { database, redis, storage };
  const status = determineHealthStatus(services);

  return {
    status,
    timestamp: new Date(),
    uptime: getUptime(),
    version: '1.0.0',
    environment: configs.APP.NODE_ENV || 'development',
    services
  };
}

export const system = {
  root: async () =>
    apiSuccess({
      name: 'Buddy Wallet API',
      version: '1.2.4',
      status: 'running',
      docs: '/health',
      debug: {
        health: '/debug/health',
        tracer: '/debug/tracer'
      }
    }),

  healthCheck: async ({ set }: SystemContext) => {
    const health = await getHealthPayload();
    if (health.status === 'unhealthy') {
      set.status = 503;
    }
    return apiSuccess(health);
  },

  readiness: async () => {
    const [database, redis] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

    if (database === 'down' || redis === 'down') {
      return apiSuccess({ ready: false, services: { database, redis } }, undefined, undefined, 503);
    }

    return apiSuccess({ ready: true, services: { database, redis } });
  },

  liveness: async () => apiSuccess({ alive: true, uptime: getUptime() }),

  info: async () => apiSuccess(getSystemInfo()),

  debugHealth: async () => {
    const html = await file(`${import.meta.dir}/../../../static/health.html`).text();
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },

  debugTracer: async () => {
    const template = await file(`${import.meta.dir}/../../../static/tracer.html`).text();
    const traces = traceStore.getAll().slice(-200).reverse();
    const stats = traceStore.stats();

    const rows = traces
      .map((trace) => {
        const time = trace.timestamp ? new Date(trace.timestamp).toISOString() : '-';
        const method = escapeHtml(String(trace.method || '-'));
        const path = escapeHtml(String(trace.path || trace.name));
        const duration = typeof trace.duration === 'number' ? `${trace.duration.toFixed(2)}ms` : '-';
        const statusClass = trace.status === 'error' ? 'err' : 'ok';
        const status = escapeHtml(String(trace.status || '-'));
        const traceId = escapeHtml(String(trace.traceId || '-'));

        return `<tr><td>${time}</td><td>${method}</td><td>${path}</td><td class="${statusClass}">${status}</td><td>${duration}</td><td>${traceId}</td></tr>`;
      })
      .join('');

    const html = renderTemplate(template, {
      TOTAL: String(stats.total),
      ERRORS: String(stats.errors),
      AVG_DURATION: String(stats.avgDuration),
      TRACE_ROWS: rows || '<tr><td colspan="6" class="warn">No trace data yet</td></tr>'
    });

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },

  debugTracesJson: async () =>
    apiSuccess({
      stats: traceStore.stats(),
      traces: traceStore.getAll()
    }),

  clearTraces: async () => {
    traceStore.clear();
    return apiSuccess({ cleared: true }, 'Traces cleared');
  }
};
