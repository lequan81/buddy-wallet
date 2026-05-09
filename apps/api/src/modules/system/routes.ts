import { Elysia } from 'elysia';
import * as v from 'valibot';
import { system } from './handlers/system.handler';
import { checkDebt } from './handlers/check-debt.handler';

export const systemRoutes = new Elysia()
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
  .get('/system/info', system.info, {
    detail: {
      tags: ['system'],
      description: 'System information'
    }
  })
  .get('/debug/health', system.debugHealth, {
    detail: {
      tags: ['system', 'debug'],
      description: 'Local health dashboard'
    }
  })
  .get('/debug/tracer', system.debugTracer, {
    detail: {
      tags: ['system', 'debug'],
      description: 'Local telemetry trace dashboard'
    }
  })
  .get('/debug/traces/json', system.debugTracesJson, {
    detail: {
      tags: ['system', 'debug'],
      description: 'Raw in-memory traces (dev)'
    }
  })
  .post('/debug/traces/clear', system.clearTraces, {
    detail: {
      tags: ['system', 'debug'],
      description: 'Clear in-memory traces'
    }
  })
  // Public API — no auth required
  .get('/check-debt', checkDebt.handler, {
    query: v.object({ phone: v.string() }),
    detail: {
      tags: ['public'],
      description: 'Check if a phone number has active debts (public, no auth required)'
    }
  });
