/**
 * System handlers.
 * @logicType http
 */

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
import { status as elysiaStatus } from 'elysia';
import type { SystemContext } from '../types/handler.types';

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
  root: async () => ({
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
    return health;
  },

  readiness: async () => {
    const [database, redis] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

    if (database === 'down' || redis === 'down') {
      return elysiaStatus(503, { ready: false, services: { database, redis } });
    }

    return { ready: true, services: { database, redis } };
  },

  liveness: async () => ({ alive: true, uptime: getUptime() }),

  info: async () => getSystemInfo(),

  debugHealth: async () => {
    const health = await getHealthPayload();
    return {
      type: 'debug_health',
      data: health,
      timestamp: new Date().toISOString()
    };
  },

  debugTracer: async () => {
    const traces = traceStore.getAll().slice(-200).reverse();
    const stats = traceStore.stats();

    return {
      type: 'debug_tracer',
      stats,
      traces,
      timestamp: new Date().toISOString()
    };
  },

  debugTracesJson: async () => ({
      stats: traceStore.stats(),
      traces: traceStore.getAll()
    }),

  clearTraces: async () => {
    traceStore.clear();
    return { cleared: true, message: 'Traces cleared' };
  }
};
