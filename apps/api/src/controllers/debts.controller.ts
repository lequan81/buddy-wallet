/**
 * Debts Controller
 *
 * Thin controller that delegates to DebtService.
 * Handles HTTP concerns (status codes, params) only.
 */
import { Elysia, t } from 'elysia';
import { GEN_ERRORS, BE_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { accessControlPlugin } from '@plugins/access-control';
import { permissionPlugin } from '@plugins/permission';
import { getUserWithFreshData } from '@plugins/session-auth';
import { PERMISSIONS, hasPermission } from '@repo/permissions';
import { debtService, activityService } from '@/services';
import { getClientIP } from '@utils';

export const debtsController = new Elysia({ prefix: '/debts' })
  .use(permissionPlugin)
  .use(accessControlPlugin)

  // List debts (own or all for admin)
  .get(
    '/',
    async ({ user, permissions }) => {
      const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
      const debts = await debtService.getDebtsForUser(user!.id, hasViewAll);
      return successResponse({ debts });
    },
    { checkPermission: PERMISSIONS.DEBT_VIEW_OWN }
  )

  // Admin: Get specific user's debts
  .get(
    '/user/:userId',
    async ({ params: { userId } }) => {
      const debts = await debtService.getDebtsByUserId(userId);
      return successResponse({ debts });
    },
    {
      params: t.Object({ userId: t.String() }),
      checkPermission: PERMISSIONS.DEBT_VIEW_ALL
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

      const result = await debtService.createDebt(body, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[]
      });

      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      // Log the create activity
      await activityService.log({
        userId: freshUser.id,
        action: 'create',
        resource: 'debt',
        resourceId: result.debt?.id,
        changes: { after: { amount: body.amount, description: body.description } },
        ipAddress: getClientIP(request) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ debt: result.debt });
    },
    {
      body: t.Object({
        amount: t.Number({ minimum: 1 }),
        description: t.String({ maxLength: 500 }),
        counterpartyPhone: t.String({ minLength: 9, maxLength: 20 }),
        direction: t.Union([t.Literal('LEND'), t.Literal('BORROW')])
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
        permissions: freshUser.permissions as string[]
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return errorResponse(BE_ERRORS.DEBT_INVALID_STATUS, result.error);
      }

      // Log the status change activity
      await activityService.log({
        userId: freshUser.id,
        action: body.status,
        resource: 'debt',
        resourceId: id,
        changes: { before: { status: result.previousStatus }, after: { status: body.status } },
        ipAddress: getClientIP(request) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

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
        permissions: freshUser.permissions as string[]
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      // Log the update activity
      await activityService.log({
        userId: freshUser.id,
        action: 'update',
        resource: 'debt',
        resourceId: id,
        changes: { after: body },
        ipAddress: getClientIP(request) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

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
        permissions: freshUser.permissions as string[]
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
        permissions: freshUser.permissions as string[]
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      // Log the delete activity
      await activityService.log({
        userId: freshUser.id,
        action: 'delete',
        resource: 'debt',
        resourceId: id,
        ipAddress: getClientIP(request) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ message: 'Debt deleted successfully' });
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN,
      ensureRelatedDebt: 'id'
    }
  );
