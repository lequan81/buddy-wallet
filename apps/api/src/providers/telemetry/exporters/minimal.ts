/**
 * Minimal Console Exporter for Development
 *
 * Shows clean, readable traces: [TRACE] GET /health 7ms
 * Also stores traces in memory for the /traces UI
 */
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import { logger } from '@repo/logger';
import { traceStore } from '../trace-store';

export class MinimalSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    for (const span of spans) {
      const durationMs = span.duration[0] * 1000 + span.duration[1] / 1e6;

      // Only store HTTP request spans (top-level requests)
      const lowerName = span.name.toLowerCase();
      if (lowerName === 'request' || span.name.startsWith('HTTP')) {
        const method = String(
          span.attributes['http.method'] || span.attributes['http.request.method'] || 'REQ'
        );
        const path = String(
          span.attributes['http.target'] ||
          span.attributes['url.path'] ||
          span.attributes['http.route'] ||
          '/'
        );

        // Skip unpopulated/empty spans generated for early 404s/unknown routes
        if (
          method === 'REQ' &&
          path === '/' &&
          !span.attributes['http.method'] &&
          !span.attributes['http.request.method'] &&
          !span.attributes['http.target'] &&
          !span.attributes['url.path']
        ) {
          continue;
        }

        const status = Number(
          span.attributes['http.status_code'] || span.attributes['http.Response.status_code'] || 0
        );

        // Store in trace store for /traces UI
        traceStore.add({
          id: span.spanContext().spanId,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          parentSpanId: span.parentSpanContext?.spanId,
          name: span.name,
          method,
          path,
          status: status >= 500 ? 'error' : status >= 400 ? 'completed' : 'completed',
          duration: durationMs,
          startTime: span.startTime[0] * 1000 + span.startTime[1] / 1e6,
          timestamp: new Date(span.startTime[0] * 1000 + span.startTime[1] / 1e6),
          attributes: span.attributes as Record<string, unknown>
        });

        const readinessSummary = span.attributes['health.summary.states'];
        if (path.startsWith('/health') && typeof readinessSummary === 'string') {
          logger.trace(
            `${method} ${path} ${status} - ${durationMs.toFixed(2)}ms [deps ${readinessSummary}]`
          );
        } else {
          logger.trace(`${method} ${path} ${status} - ${durationMs.toFixed(2)}ms`);
        }
      }
      // Store error spans too
      else if (span.status.code === 2) {
        // SpanStatusCode.ERROR
        traceStore.add({
          id: span.spanContext().spanId,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          parentSpanId: span.parentSpanContext?.spanId,
          name: span.name,
          duration: durationMs,
          status: 'error',
          startTime: span.startTime[0] * 1000 + span.startTime[1] / 1e6,
          timestamp: new Date(span.startTime[0] * 1000 + span.startTime[1] / 1e6),
          error: span.status.message,
          attributes: span.attributes as Record<string, unknown>
        });
      }
    }
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
