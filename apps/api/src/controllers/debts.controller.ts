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
import { debtService } from '@/services';

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
    async ({ user, body, set }) => {
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
    async ({ user, params: { id }, body, set }) => {
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
  );
