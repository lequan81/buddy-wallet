/**
 * Debts Controller
 *
 * Thin controller that delegates to DebtService via DI.
 * Uses Elysia decorate() pattern for service injection.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { sessionAuthPlugin, accessControlPlugin, servicesPlugin } from '@plugins';
import { permissionPlugin } from '@plugins/guards';
import { standardRateLimiter } from '@plugins/middleware';
import { getUserWithFreshData } from '@plugins/auth';
import { PERMISSIONS, hasPermission } from '@repo/permissions';
import {
  ErrorResponseSchema,
  DebtListResponseSchema,
  DebtQuerySchema,
  CreateDebtSchema,
  UpdateDebtStatusSchema,
  UpdateDebtSchema,
  SuggestDebtEditSchema,
  DeleteBatchDebtSchema
} from '@repo/schemas';
import { getClientIP } from '@utils';
import { getIdempotentResponse, storeIdempotentResponse } from '@/utils/idempotency';
import { logger } from '@repo/logger';
import { configs } from '../../configs';




export const DebtsController = new Elysia({ prefix: '/debts' })
  .use(servicesPlugin) // Inject services via DI
  .use(sessionAuthPlugin)
  .use(permissionPlugin)
  .use(accessControlPlugin)
  .use(standardRateLimiter)
  // Derived fresh user data for critical operations
  .derive({ as: 'scoped' }, async ({ user }) => {
    if (!user) return { freshUser: null };
    const freshUser = await getUserWithFreshData(user.id);
    return { freshUser };
  })

  // List debts (own or all for admin) with pagination
  .get(
    '/',
    async ({ debtService, user, permissions, query, set }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
      const limit = query.limit ? Math.min(parseInt(query.limit), configs.PAGINATION.MAX_LIMIT) : configs.PAGINATION.DEFAULT_LIMIT;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const status = query.status || undefined;

      const result = await debtService.getDebtsForUser(user.id, hasViewAll, {
        limit,
        offset,
        status
      });

      return successResponse({
        debts: result.data,
        pagination: result.pagination
      });
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
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
      const result = await debtService.getDebtsForUser(user.id, hasViewAll, {
        limit: 5,
        offset: 0
      });

      // Return simplified recent debt data
      const recentDebts = result.data.map((debt: typeof result.data[0]) => ({
        id: debt.id,
        description: debt.description,
        amount: debt.amount.toString(),
        phone: debt.debtorPhone || debt.creditorPhone || '',
        createdAt: debt.createdAt
      }));

      return successResponse({ debts: recentDebts });
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN
    }
  )

  // Admin: Get specific user's debts with pagination
  .get(
    '/user/:userId',
    async ({ debtService, params: { userId }, query }) => {
      const limit = query.limit ? Math.min(parseInt(query.limit), configs.PAGINATION.MAX_LIMIT) : configs.PAGINATION.DEFAULT_LIMIT;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const status = query.status || undefined;

      const result = await debtService.getDebtsByUserId(userId, {
        limit,
        offset,
        status
      });

      return successResponse({
        debts: result.data,
        pagination: result.pagination
      });
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
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const contacts = await debtService.getRecentContacts(user.id, 10);
      return successResponse({ contacts });
    },
    { checkPermission: PERMISSIONS.DEBT_VIEW_OWN }
  )

  // Get single debt by ID
  .get(
    '/:id',
    async ({ debtService, params: { id }, set }) => {
      const debt = await debtService.getDebtById(id);
      if (!debt) {
        set.status = 404;
        return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
      }
      return successResponse({ debt });
    },
    {
      params: t.Object({ id: t.String() }),
      ensureRelatedDebt: 'id'
    }
  )

  // Create new debt (with idempotency support)
  .post(
    '/',
    async ({ debtService, body, set, headers, freshUser }) => {
      // Check idempotency key first
      const idempotencyKey = headers['idempotency-key'] || headers['Idempotency-Key'];
      if (idempotencyKey) {
        const cached = await getIdempotentResponse<{ success: true; debt: unknown } | { success: false; error: unknown }>(idempotencyKey);
        if (cached) {
          logger.info('Idempotency cache hit for debt creation', { key: idempotencyKey });
          set.headers['X-Idempotency-Key'] = idempotencyKey;
          set.headers['X-Idempotency-Replay'] = 'true';
          if ('debt' in cached) {
            return successResponse({ debt: cached.debt });
          }
          // Return cached error as proper response
          return cached.error as Response;
        }
      }

      if (!freshUser) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await debtService.createDebt(
        {
          amount: body.amount,
          description: body.description,
          counterpartyPhone: body.counterpartyPhone,
          direction: body.direction
        },
        {
          id: freshUser.id,
          phoneNumber: freshUser.phoneNumber,
          permissions: freshUser.permissions as string[],
          role: freshUser.role,
          email: freshUser.email
        },
        {
          expiryOption: body.expiryOption as 'never' | '7d' | '30d' | '90d' | undefined,
          confirmDuplicate: body.confirmDuplicate
        }
      );

      if (!result.success) {
        // Return duplicate warning with duplicates info
        if (result.code === 'DUPLICATE_WARNING') {
          set.status = 409; // Conflict
          const error = errorResponse({
            code: result.code || 'DUPLICATE_WARNING',
            message: result.error || 'Duplicate debts detected'
          });
          if (idempotencyKey) {
            await storeIdempotentResponse(idempotencyKey, { success: false, error });
            set.headers['X-Idempotency-Key'] = idempotencyKey;
          }
          return error;
        }
        set.status = 400;
        const error = errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
        if (idempotencyKey) {
          await storeIdempotentResponse(idempotencyKey, { success: false, error });
          set.headers['X-Idempotency-Key'] = idempotencyKey;
        }
        return error;
      }

      const response = { debt: result.debt };
      
      // Store successful response for idempotency
      if (idempotencyKey) {
        await storeIdempotentResponse(idempotencyKey, { success: true, debt: result.debt });
        set.headers['X-Idempotency-Key'] = idempotencyKey;
      }

      return successResponse(response);
    },
    {
      body: CreateDebtSchema,
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  )

  // Update debt status
  .patch(
    '/:id/status',
    async ({ debtService, params: { id }, body, set, freshUser }) => {
      if (!freshUser) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await debtService.updateDebtStatus(id, body.status, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return errorResponse(BE_ERRORS.DEBT_INVALID_STATUS, result.error);
      }

      return successResponse({ debt: result.debt });
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
    async ({ debtService, params: { id }, body, set, freshUser }) => {
      if (!freshUser) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await debtService.updateDebt(id, body, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return successResponse({ debt: result.debt });
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateDebtSchema,
      checkPermission: PERMISSIONS.DEBT_UPDATE_OWN,
      ensureRelatedDebt: 'id'
    }
  )

  // Batch delete debts (must be before /:id to avoid route conflict)
  .delete(
    '/batch',
    async ({ debtService, activityService, body, set, request, server, freshUser }) => {
      if (!freshUser) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      if (body.ids.length > 50) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, 'Cannot delete more than 50 debts at once');
      }

      const result = await debtService.deleteDebts(body.ids, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      // Log the batch delete activity
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

      return successResponse({
        deleted: result.deleted,
        errors: result.errors
      });
    },
    {
      body: DeleteBatchDebtSchema,
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN
    }
  )

  // Delete all user's debts (must be before /:id to avoid route conflict)
  .delete(
    '/all',
    async ({ debtService, activityService, user, query, set, request, server }) => {
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      if (query.confirm !== 'true') {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, 'Must confirm deletion with ?confirm=true');
      }

      const result = await debtService.deleteAllDebts(user.id);

      // Log the delete all activity
      if (result.deleted > 0) {
        await activityService.log({
          userId: user.id,
          action: 'delete_all',
          resource: 'debt',
          metadata: { deletedCount: result.deleted },
          ipAddress: getClientIP(request, server) || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }

      return successResponse({
        message: 'All debts deleted successfully',
        deleted: result.deleted
      });
    },
    {
      query: t.Object({
        confirm: t.String()
      }),
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN
    }
  )

  // Delete single debt (soft delete)
  .delete(
    '/:id',
    async ({ debtService, params: { id }, set, freshUser }) => {
      if (!freshUser) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await debtService.deleteDebt(id, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return successResponse({ message: 'Debt deleted successfully' });
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
    async ({ debtService, params: { id }, set, freshUser }) => {
      if (!freshUser) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await debtService.confirmDebt(id, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      if (!result.success) {
        if (result.code === 'NOT_FOUND') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        if (result.code === 'FORBIDDEN') {
          set.status = 403;
          return errorResponse(GEN_ERRORS.FORBIDDEN, result.error);
        }
        if (result.code === 'ALREADY_CONFIRMED') {
          return successResponse({ message: result.error });
        }
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return successResponse({ debt: result.debt, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      ensureRelatedDebt: 'id'
    }
  )

  // Suggest edit to a debt (counterparty only)
  .post(
    '/:id/suggest',
    async ({ debtService, activityService, params: { id }, body, set, request, server, freshUser }) => {
      if (!freshUser) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await debtService.suggestEdit(
        id,
        {
          id: freshUser.id,
          phoneNumber: freshUser.phoneNumber,
          permissions: freshUser.permissions as string[],
          role: freshUser.role,
          email: freshUser.email
        },
        {
          amount: body.amount,
          description: body.description
        }
      );

      if (!result.success) {
        if (result.code === 'NOT_FOUND') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        if (result.code === 'FORBIDDEN') {
          set.status = 403;
          return errorResponse(GEN_ERRORS.FORBIDDEN, result.error);
        }
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
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

      return successResponse({ debt: result.debt, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      body: SuggestDebtEditSchema,
      ensureRelatedDebt: 'id'
    }
  )

  // Respond to suggested edit (creator only)
  .post(
    '/:id/suggestion/respond',
    async ({ debtService, activityService, params: { id }, body, set, request, server, freshUser }) => {
      if (!freshUser) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await debtService.respondToSuggestion(
        id,
        {
          id: freshUser.id,
          phoneNumber: freshUser.phoneNumber,
          permissions: freshUser.permissions as string[],
          role: freshUser.role,
          email: freshUser.email
        },
        body.accept
      );

      if (!result.success) {
        if (result.code === 'NOT_FOUND') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        if (result.code === 'FORBIDDEN') {
          set.status = 403;
          return errorResponse(GEN_ERRORS.FORBIDDEN, result.error);
        }
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      await activityService.log({
        userId: freshUser.id,
        action: body.accept ? 'accept_suggestion' : 'reject_suggestion',
        resource: 'debt',
        resourceId: id,
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ debt: result.debt, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        accept: t.Boolean()
      }),
      ensureRelatedDebt: 'id'
    }
  );
