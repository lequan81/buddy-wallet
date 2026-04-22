import { Elysia } from 'elysia';
import { container } from 'tsyringe';
import { HealthService } from '@/app/Services/HealthService';
import { apiSuccess, apiError } from '@/lib/http';
import { GEN_ERRORS } from '@repo/errors';

/**
 * Web Routes
 * 
 * Defines non-API routes like health checks and general system endpoints.
 */
export const registerWebRoutes = (app: Elysia<any, any, any, any, any, any, any>): any => {
  const healthService = container.resolve(HealthService);

  return app.group('', (web) =>
    web
      // --- HEALTH CHECKS ---
      .get('/health', () => apiSuccess(healthService.getSystemHealth()))
      .get('/health/ready', async ({ set }) => {
        const storage = await healthService.getStorageLiveReadiness();
        if (!storage.ready) {
          set.status = 503;
          return apiError(GEN_ERRORS.NETWORK, storage.reason || 'Storage degraded');
        }
        return apiSuccess({ status: 'ready', storage });
      })

      // --- DEFAULT ROUTE ---
      .get('/', () => apiSuccess({
        name: 'Buddy Wallet API',
        version: '1.2.4',
        status: 'running',
        docs: '/health'
      }))
  );
};

