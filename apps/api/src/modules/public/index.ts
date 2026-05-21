import { Elysia } from 'elysia';
import { checkDebt } from './handlers/check-debt.handler';
import * as v from 'valibot';

/**
 * Public Routes - Grouped under /v1/public
 * Public endpoints that don't require authentication
 */
export const publicRoutes = new Elysia()
  .group('/public', (app) => app
    .get('/debts/check', checkDebt.handler, {
      query: v.object({ phone: v.string() }),
      detail: {
        tags: ['public'],
        description: 'Check if a phone number has active debts (public, no auth required)'
      }
    })
  );
