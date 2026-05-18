/**
 * Telemetry Module - OpenTelemetry Instrumentation
 *
 * Provides distributed tracing and observability for the Buddy Wallet API.
 *
 * Dev Mode: Minimal trace logs like [TRACE] GET /health 7ms
 * Production: Full OpenTelemetry with OTLP export
 *
 * Usage: Import and use `telemetry` plugin in your Elysia app
 *
 * @example
 * ```typescript
 * import { telemetry } from '@/lib/telemetry';
 *
 * const app = new Elysia()
 *   .use(telemetry)
 *   .get('/health', () => 'OK');
 * ```
 */

import { opentelemetry } from '@elysiajs/opentelemetry';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { logger } from '@repo/logger';
import { env } from '@repo/config';
import { MinimalSpanExporter } from './exporters/minimal';

const isDev = env.string('NODE_ENV', 'development') !== 'production';
const serviceName = env.string('OTEL_SERVICE_NAME', 'buddy-wallet-api');

/**
 * Configure exporter based on environment
 */
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
          Authorization: `Bearer ${env.string('AXIOM_TOKEN', '')}`,
          'X-Axiom-Dataset': env.string('AXIOM_DATASET', 'buddy-wallet')
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

/**
 * Telemetry plugin for Elysia
 * Automatically traces all HTTP requests
 */
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

// Re-export for advanced use cases
export { MinimalSpanExporter } from './exporters/minimal';
export { traceStore } from './trace-store';
