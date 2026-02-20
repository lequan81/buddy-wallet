/**
 * OpenTelemetry Instrumentation for Buddy Wallet API
 *
 * This file must be preloaded before the main application starts.
 * Configure in bunfig.toml: preload = ["./src/instrumentation.ts"]
 *
 * Dev Mode: Minimal trace logs like [TRACE] GET /health 7ms
 * Production: Full OpenTelemetry with OTLP export
 */

import { opentelemetry } from '@elysiajs/opentelemetry';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import { logger } from '@repo/logger';
import { traceStore } from './utils/trace-store';

const isDev = Bun.env.NODE_ENV !== 'production';
const serviceName = Bun.env.OTEL_SERVICE_NAME || 'buddy-wallet-api';

/**
 * Minimal Console Exporter for Development
 * Shows clean, readable traces: [TRACE] GET /health 7ms
 * Also stores traces in memory for the /traces UI
 */
class MinimalSpanExporter implements SpanExporter {
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
        const status = Number(
          span.attributes['http.status_code'] || span.attributes['http.response.status_code'] || 0
        );

        // Store in trace store for /traces UI
        traceStore.add({
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          parentSpanId: span.parentSpanContext?.spanId,
          name: span.name,
          method,
          path,
          status,
          duration: durationMs,
          timestamp: new Date(span.startTime[0] * 1000 + span.startTime[1] / 1e6),
          attributes: span.attributes as Record<string, unknown>
        });

        logger.trace(`${method} ${path} ${status} - ${durationMs.toFixed(2)}ms`);
      }
      // Store error spans too
      else if (span.status.code === 2) {
        // SpanStatusCode.ERROR
        traceStore.add({
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          parentSpanId: span.parentSpanContext?.spanId,
          name: span.name,
          duration: durationMs,
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

// Configure exporter based on environment
function createExporter(): SpanExporter | null {
  // PRODUCTION: Full OpenTelemetry with OTLP export
  if (!isDev) {
    const endpoint = Bun.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    if (!endpoint) {
      logger.app(`OpenTelemetry disabled in production (no OTEL_EXPORTER_OTLP_ENDPOINT)`);
      return null;
    }

    logger.app(`OpenTelemetry exporting to: ${endpoint}`);

    // Support for Axiom
    if (endpoint.includes('axiom.co')) {
      return new OTLPTraceExporter({
        url: endpoint,
        headers: {
          Authorization: `Bearer ${Bun.env.AXIOM_TOKEN}`,
          'X-Axiom-Dataset': Bun.env.AXIOM_DATASET || 'buddy-wallet'
        }
      });
    }

    // Generic OTLP endpoint (Jaeger, Zipkin, Grafana Tempo, etc.)
    return new OTLPTraceExporter({ url: endpoint });
  }

  // DEVELOPMENT: Minimal readable traces
  logger.app(`OpenTelemetry using minimal exporter (dev mode)`);
  return new MinimalSpanExporter();
}

const exporter = createExporter();

// Create the telemetry plugin
export const telemetry = exporter
  ? opentelemetry({
      serviceName,
      spanProcessors: [
        isDev
          ? new SimpleSpanProcessor(exporter) // Immediate export in dev
          : new BatchSpanProcessor(exporter) // Batched export in prod
      ]
    })
  : null;

if (exporter) {
  logger.app(`OpenTelemetry initialized`, {
    service: serviceName,
    mode: isDev ? 'minimal (dev)' : 'full OTLP (prod)'
  });
}
