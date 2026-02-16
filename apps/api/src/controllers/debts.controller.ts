/**
 * Debts Controller
 *
 * Thin controller that delegates to DebtService.
 * Handles HTTP concerns (status codes, params) only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { accessControlPlugin } from '../plugins';
import { permissionPlugin } from '../plugins/guards';
import { standardRateLimiter } from '../plugins/middleware';
import { getUserWithFreshData } from '../plugins/auth';
import { PERMISSIONS, hasPermission } from '@repo/permissions';
import { debtService, activityService } from '../services';
import { getClientIP } from '../utils';

export const debtsController = new Elysia({ prefix: '/debts' })
  .use(permissionPlugin)
  .use(accessControlPlugin)
  // Apply standard rate limit (100 req/min) for all debt endpoints
  .use(standardRateLimiter)

  // List debts (own or all for admin) with pagination
  .get(
    '/',
    async ({ user, permissions, query }) => {
      const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
      const limit = query.limit ? Math.min(parseInt(query.limit), 100) : 50;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const status = query.status || undefined;

      const result = await debtService.getDebtsForUser(user!.id, hasViewAll, {
        limit,
        offset,
        status
      });

      return successResponse({
        debts: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.data.length < result.total
        }
      });
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN,
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String())
      })
    }
  )

  // Admin: Get specific user's debts with pagination
  .get(
    '/user/:userId',
    async ({ params: { userId }, query }) => {
      const limit = query.limit ? Math.min(parseInt(query.limit), 100) : 50;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const status = query.status || undefined;

      const result = await debtService.getDebtsByUserId(userId, {
        limit,
        offset,
        status
      });

      return successResponse({
        debts: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.data.length < result.total
        }
      });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String())
      }),
      checkPermission: PERMISSIONS.DEBT_VIEW_ALL
    }
  )

  // Get recent contacts (phone numbers user has interacted with)
  .get(
    '/recent-contacts',
    async ({ user }) => {
      const contacts = await debtService.getRecentContacts(user!.id, 10);
      return successResponse({ contacts });
    },
    { checkPermission: PERMISSIONS.DEBT_VIEW_OWN }
  )

  // Get single debt by ID
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
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

  // Create new debt
  .post(
    '/',
    async ({ user, body, set, request }) => {
      // SECURITY FIX 2: Get fresh user data from database (bypassing cache)
      // This ensures phoneNumber is from authoritative source
      const freshUser = await getUserWithFreshData(user!.id);
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
          return {
            success: false,
            error: result.error,
            code: result.code,
            duplicates: (result as any).duplicates
          };
        }
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return successResponse({ debt: result.debt });
    },
    {
      body: t.Object({
        amount: t.Number({ minimum: 1 }),
        description: t.String({ maxLength: 500 }),
        counterpartyPhone: t.String({ minLength: 9, maxLength: 20 }),
        direction: t.Union([t.Literal('LEND'), t.Literal('BORROW')]),
        expiryOption: t.Optional(
          t.Union([t.Literal('never'), t.Literal('7d'), t.Literal('30d'), t.Literal('90d')])
        ),
        confirmDuplicate: t.Optional(t.Boolean())
      }),
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  )

  // Update debt status
  .patch(
    '/:id/status',
    async ({ user, params: { id }, body, set, request }) => {
      // SECURITY FIX 2: Get fresh user data from database (bypassing cache)
      const freshUser = await getUserWithFreshData(user!.id);
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
      body: t.Object({
        status: t.Union([
          t.Literal('pending'),
          t.Literal('confirmed'),
          t.Literal('paid'),
          t.Literal('disputed'),
          t.Literal('cancelled')
        ])
      }),
      ensureRelatedDebt: 'id'
    }
  )

  // Update debt details (description/amount)
  .put(
    '/:id',
    async ({ user, params: { id }, body, set, request }) => {
      const freshUser = await getUserWithFreshData(user!.id);
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
      body: t.Object({
        description: t.Optional(t.String({ maxLength: 500 })),
        amount: t.Optional(t.Number({ minimum: 1 }))
      }),
      checkPermission: PERMISSIONS.DEBT_UPDATE_OWN,
      ensureRelatedDebt: 'id'
    }
  )

  // Batch delete debts (must be before /:id to avoid route conflict)
  .delete(
    '/batch',
    async ({ user, body, set, request }) => {
      const freshUser = await getUserWithFreshData(user!.id);
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
          ipAddress: getClientIP(request) || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }

      return successResponse({
        deleted: result.deleted,
        errors: result.errors
      });
    },
    {
      body: t.Object({
        ids: t.Array(t.String(), { minItems: 1, maxItems: 50 })
      }),
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN
    }
  )

  // Delete all user's debts (must be before /:id to avoid route conflict)
  .delete(
    '/all',
    async ({ user, query, set, request }) => {
      if (query.confirm !== 'true') {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, 'Must confirm deletion with ?confirm=true');
      }

      const result = await debtService.deleteAllDebts(user!.id);

      // Log the delete all activity
      if (result.deleted > 0) {
        await activityService.log({
          userId: user!.id,
          action: 'delete_all',
          resource: 'debt',
          metadata: { deletedCount: result.deleted },
          ipAddress: getClientIP(request) || undefined,
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
    async ({ user, params: { id }, set, request }) => {
      const freshUser = await getUserWithFreshData(user!.id);
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
    async ({ user, params: { id }, set, request }) => {
      const freshUser = await getUserWithFreshData(user!.id);
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
    async ({ user, params: { id }, body, set, request }) => {
      const freshUser = await getUserWithFreshData(user!.id);
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
        ipAddress: getClientIP(request) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ debt: result.debt, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        amount: t.Optional(t.Number({ minimum: 1 })),
        description: t.Optional(t.String({ maxLength: 500 }))
      }),
      ensureRelatedDebt: 'id'
    }
  )

  // Respond to suggested edit (creator only)
  .post(
    '/:id/suggestion/respond',
    async ({ user, params: { id }, body, set, request }) => {
      const freshUser = await getUserWithFreshData(user!.id);
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
        ipAddress: getClientIP(request) || undefined,
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
