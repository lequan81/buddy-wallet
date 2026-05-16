import { Elysia } from 'elysia';
import { system } from './handlers/system.handler';

/**
 * System Routes - Grouped under /v1/system
 * System endpoints: health checks, debug, system info
 */
export const systemRoutes = new Elysia()
  .group('/system', (app) => app
    .get('/', system.root, {
      detail: {
        tags: ['system'],
        description: 'API root'
      }
    })
    .get('/health', system.healthCheck, {
      detail: {
        tags: ['system'],
        description: 'Health check endpoint'
      }
    })
    .get('/health/ready', system.readiness, {
      detail: {
        tags: ['system'],
        description: 'Readiness check'
      }
    })
    .get('/health/live', system.liveness, {
      detail: {
        tags: ['system'],
        description: 'Liveness check'
      }
    })
    .get('/info', system.info, {
      detail: {
        tags: ['system'],
        description: 'System information'
      }
    })
    .group('/debug', (debug) => debug
      .get('/health', system.debugHealth, {
        detail: {
          tags: ['system', 'debug'],
          description: 'Local health dashboard'
        }
      })
      .get('/tracer', system.debugTracer, {
        detail: {
          tags: ['system', 'debug'],
          description: 'Local telemetry trace dashboard'
        }
      })
      .get('/traces/json', system.debugTracesJson, {
        detail: {
          tags: ['system', 'debug'],
          description: 'Raw in-memory traces (dev)'
        }
      })
      .post('/traces/clear', system.clearTraces, {
        detail: {
          tags: ['system', 'debug'],
          description: 'Clear in-memory traces'
        }
      })
    )
  );
