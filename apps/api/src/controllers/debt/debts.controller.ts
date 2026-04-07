/**
 * Debts Controller
 *
 * Thin controller that delegates to DebtService via DI.
 * Uses Elysia decorate() pattern for service injection.
 */
import { Elysia, t } from 'elysia';
import { apiResponse, GEN_ERRORS, BE_ERRORS } from '@repo/errors';
import {
  accessControlPlugin,
  permissionPlugin,
  servicesPlugin,
  sessionAuthPlugin
} from '@plugins';
import { standardRateLimiter } from '@plugins/middleware';
import { PERMISSIONS, hasPermission } from '@repo/permissions';
import {
  ErrorResponseSchema,
  DebtListResponseSchema,
  RecentDebtsResponseSchema,
  DebtQuerySchema,
  CreateDebtSchema,
  UpdateDebtStatusSchema,
  UpdateDebtSchema,
  SuggestDebtEditSchema,
  DeleteBatchDebtSchema
} from '@repo/schemas';
import { getClientIP } from '@utils';
import { logger } from '@repo/logger';
import { parseOffsetPagination } from '@/core/http/pagination';
import { requireAuth } from '@/core/http/require-auth';
import { isFailureResult, respondFailure } from '@/core/http/result-helper';
import { DEFAULT_DEBT_FAILURE, DEBT_ERROR_MAP } from '@/core/http/error-maps/debt.error-map';
import {
  getIdempotencyKey,
  setIdempotencyHeaders,
  getIdempotentResponse,
  storeIdempotentResponse
} from '@/core/http/idempotency';
import { resolveActor } from '@/core/http/response.helpers';
import type { Debt } from '@repo/db';

type DebtServiceFailure = {
  success: boolean;
  error?: string;
  code?: string;
};

const respondDebtFailure = (set: { status?: number | string }, result: DebtServiceFailure) => {
  return respondFailure(set, result, {
    map: DEBT_ERROR_MAP,
    fallback: DEFAULT_DEBT_FAILURE
  });
};

const getPreloadedDebt = (ctx: unknown): Debt | null => {
  const relatedDebt = (ctx as { relatedDebt?: Debt | null }).relatedDebt;
  return relatedDebt ?? null;
};

export const DebtsController = new Elysia({ prefix: '/debts' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(permissionPlugin)
  .use(accessControlPlugin)
  .use(standardRateLimiter)

  .get(
    '/',
    async (ctx) => {
      const { debtService, user, permissions, query, set } = ctx;
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        set.status = 401;
        return auth.error;
      }

      const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
      const { limit, offset } = parseOffsetPagination(query);
      const status = query.status || undefined;

      const result = await debtService.getDebts(auth.user.id, {
        limit,
        offset,
        status,
        viewAll: hasViewAll
      });

      return apiResponse({ ok: true, data: result });
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN,
      query: DebtQuerySchema,
      response: {
        200: DebtListResponseSchema,
        401: ErrorResponseSchema
      }
    }
  )

  // Get recent debts for quick actions
  .get(
    '/recent',
    async ({ debtService, user, permissions, set }) => {
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        set.status = 401;
        return auth.error;
      }
      const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
      const result = await debtService.getDebts(auth.user.id, {
        limit: 5,
        offset: 0,
        viewAll: hasViewAll
      });

      // Return simplified recent debt data
      const recentDebts = result.data.map((debt) => ({
        id: debt.id,
        description: debt.description,
        amount: debt.amount.toString(),
        phone: debt.debtorPhone || debt.creditorPhone || '',
        createdAt: (debt.createdAt instanceof Date ? debt.createdAt.toISOString() : String(debt.createdAt))
      }));

      return apiResponse({ ok: true, data: { data: recentDebts } });
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN,
      response: {
        200: RecentDebtsResponseSchema,
        401: ErrorResponseSchema
      }
    }
  )

  // Admin: Get specific user's debts with pagination
  .get(
    '/user/:userId',
    async ({ debtService, params: { userId }, query }) => {
      const { limit, offset } = parseOffsetPagination(query);
      const status = query.status || undefined;

      const result = await debtService.getDebts(userId, {
        limit,
        offset,
        status
      });

      return apiResponse({ ok: true, data: result });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: DebtQuerySchema,
      checkPermission: PERMISSIONS.DEBT_VIEW_ALL
    }
  )

  // Get recent contacts (phone numbers user has interacted with)
  .get(
    '/recent-contacts',
    async ({ debtService, user, set }) => {
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const contacts = await debtService.getRecentContacts(auth.user.id, 10);
      return apiResponse({ ok: true, data: { contacts } });
    },
    { checkPermission: PERMISSIONS.DEBT_VIEW_OWN }
  )

  // Get single debt by ID
  .get(
    '/:id',
    async (ctx) => {
      const { debtService, params: { id }, set } = ctx;
      const preloadedDebt = getPreloadedDebt(ctx);
      const debt = preloadedDebt ?? (await debtService.getDebtById(id));
      if (!debt) {
        set.status = 404;
        return apiResponse({ ok: false, error: BE_ERRORS.DEBT_NOT_FOUND });
      }
      return apiResponse({ ok: true, data: { debt } });
    },
    {
      params: t.Object({ id: t.String() }),
      ensureRelatedDebt: 'id'
    }
  )

  // Create new debt (with idempotency support)
  .post(
    '/',
    async ({ debtService, body, user, set, headers }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { actor } = resolved;

      // Check idempotency key first
      const idempotencyKey = getIdempotencyKey(headers);
      if (idempotencyKey) {
        const cached = await getIdempotentResponse<
          { success: true; debt: unknown } | { success: false; error: unknown }
        >(idempotencyKey);
        if (cached) {
          logger.info('Idempotency cache hit for debt creation', { key: idempotencyKey });
          setIdempotencyHeaders(set, idempotencyKey, { replay: true });
          if ('debt' in cached) {
            return apiResponse({ ok: true, data: { debt: cached.debt } });
          }
          return cached.error;
        }
      }

      const result = await debtService.createDebt(
        {
          amount: body.amount,
          description: body.description,
          counterpartyPhone: body.counterpartyPhone,
          direction: body.direction
        },
        actor,
        {
          expiryOption: body.expiryOption as 'never' | '7d' | '30d' | '90d' | undefined,
          confirmDuplicate: body.confirmDuplicate
        }
      );

      if (isFailureResult(result)) {
        const error = respondDebtFailure(set, result);
        if (idempotencyKey) {
          await storeIdempotentResponse(idempotencyKey, { success: false, error });
          setIdempotencyHeaders(set, idempotencyKey);
        }
        return error;
      }

      const response = { debt: result.debt };
      if (idempotencyKey) {
        await storeIdempotentResponse(idempotencyKey, { success: true, debt: result.debt });
        setIdempotencyHeaders(set, idempotencyKey);
      }

      return apiResponse({ ok: true, data: response });
    },
    {
      body: CreateDebtSchema,
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  )

  // Update debt status
  .patch(
    '/:id/status',
    async (ctx) => {
      const { debtService, params: { id }, body, user, set } = ctx;
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { actor } = resolved;
      const preloadedDebt = getPreloadedDebt(ctx);

      const result = await debtService.updateDebtStatus(id, body.status, actor, preloadedDebt);

      if (isFailureResult(result)) {
        return respondDebtFailure(set, result);
      }

      return apiResponse({ ok: true, data: { debt: result.debt } });
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateDebtStatusSchema,
      ensureRelatedDebt: 'id'
    }
  )

  // Update debt details (description/amount)
  .put(
    '/:id',
    async (ctx) => {
      const { debtService, params: { id }, body, user, set } = ctx;
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { actor } = resolved;
      const preloadedDebt = getPreloadedDebt(ctx);

      const result = await debtService.updateDebt(id, body, actor, preloadedDebt);

      if (isFailureResult(result)) {
        return respondDebtFailure(set, result);
      }

      return apiResponse({ ok: true, data: { debt: result.debt } });
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateDebtSchema,
      checkPermission: PERMISSIONS.DEBT_UPDATE_OWN,
      ensureRelatedDebt: 'id'
    }
  )

  // Batch delete debts
  .delete(
    '/batch',
    async ({ debtService, activityService, body, user, set, request, server }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { actor, user: freshUser } = resolved;

      if (body.ids.length > 50) {
        set.status = 400;
        return apiResponse({
          ok: false,
          error: GEN_ERRORS.INVALID_INPUT,
          details: 'Cannot delete more than 50 debts at once'
        });
      }

      const result = await debtService.deleteDebts(body.ids, actor);

      if (result.deleted > 0) {
        await activityService.log({
          userId: freshUser.id,
          action: 'delete',
          resource: 'debt',
          metadata: { deletedCount: result.deleted, ids: body.ids },
          ipAddress: getClientIP(request, server) || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }

      return apiResponse({
        ok: true,
        data: {
        deleted: result.deleted,
        errors: result.errors
      }});
    },
    {
      body: DeleteBatchDebtSchema,
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN
    }
  )

  // Delete all user's debts
  .delete(
    '/all',
    async ({ debtService, activityService, user, query, set, request, server }) => {
      const auth = requireAuth(user, set);
      if ('error' in auth) {
          return auth.error;
      }
      
      if (query.confirm !== 'true') {
        set.status = 400;
        return apiResponse({
          ok: false,
          error: GEN_ERRORS.INVALID_INPUT,
          details: 'Must confirm deletion with ?confirm=true'
        });
      }

      const result = await debtService.deleteAllDebts(auth.user.id);

      if (result.deleted > 0) {
        await activityService.log({
          userId: auth.user.id,
          action: 'delete_all',
          resource: 'debt',
          metadata: { deletedCount: result.deleted },
          ipAddress: getClientIP(request, server) || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }

      return apiResponse({
        ok: true,
        data: {
        message: 'All debts deleted successfully',
        deleted: result.deleted
      }});
    },
    {
      query: t.Object({
        confirm: t.String()
      }),
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN
    }
  )

  // Delete single debt
  .delete(
    '/:id',
    async (ctx) => {
      const { debtService, params: { id }, user, set } = ctx;
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { actor } = resolved;
      const preloadedDebt = getPreloadedDebt(ctx);

      const result = await debtService.deleteDebt(id, actor, preloadedDebt);

      if (isFailureResult(result)) {
        return respondDebtFailure(set, result);
      }

      return apiResponse({ ok: true, data: { message: 'Debt deleted successfully' } });
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN,
      ensureRelatedDebt: 'id'
    }
  )

  // Confirm debt by counterparty
  .post(
    '/:id/confirm',
    async (ctx) => {
      const { debtService, params: { id }, user, set } = ctx;
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { actor } = resolved;
      const preloadedDebt = getPreloadedDebt(ctx);

      const result = await debtService.confirmDebt(id, actor, preloadedDebt);

      if (isFailureResult(result)) {
        if (result.code === BE_ERRORS.DEBT_ALREADY_CONFIRMED.code) {
          return apiResponse({
            ok: true,
            data: { message: result.error || BE_ERRORS.DEBT_ALREADY_CONFIRMED.message }
          });
        }
        return respondDebtFailure(set, result);
      }

      return apiResponse({ ok: true, data: { debt: result.debt, message: result.message } });
    },
    {
      params: t.Object({ id: t.String() }),
      ensureRelatedDebt: 'id'
    }
  )

  // Suggest edit to a debt
  .post(
    '/:id/suggest',
    async (ctx) => {
      const { debtService, activityService, params: { id }, body, user, set, request, server } = ctx;
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { actor, user: freshUser } = resolved;
      const preloadedDebt = getPreloadedDebt(ctx);

      const result = await debtService.suggestEdit(id, actor, body, preloadedDebt);

      if (isFailureResult(result)) {
        return respondDebtFailure(set, result);
      }

      await activityService.log({
        userId: freshUser.id,
        action: 'suggest_edit',
        resource: 'debt',
        resourceId: id,
        changes: { after: body },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return apiResponse({ ok: true, data: { debt: result.debt, message: result.message } });
    },
    {
      params: t.Object({ id: t.String() }),
      body: SuggestDebtEditSchema,
      ensureRelatedDebt: 'id'
    }
  )

  // Respond to suggested edit
  .post(
    '/:id/suggestion/respond',
    async (ctx) => {
      const { debtService, activityService, params: { id }, body, user, set, request, server } = ctx;
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { actor, user: freshUser } = resolved;
      const preloadedDebt = getPreloadedDebt(ctx);

      const result = await debtService.respondToSuggestion(id, actor, body.accept, preloadedDebt);

      if (isFailureResult(result)) {
        return respondDebtFailure(set, result);
      }

      await activityService.log({
        userId: freshUser.id,
        action: body.accept ? 'accept_suggestion' : 'reject_suggestion',
        resource: 'debt',
        resourceId: id,
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return apiResponse({ ok: true, data: { debt: result.debt, message: result.message } });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ accept: t.Boolean() }),
      ensureRelatedDebt: 'id'
    }
  );
