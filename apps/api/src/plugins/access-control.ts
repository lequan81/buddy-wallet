import { Elysia } from 'elysia';
import { db, debts, eq, or, and } from '@repo/db';
import { jwtPlugin } from './jwt';

export const accessControlPlugin = new Elysia({ name: 'Access_Control' })
  .use(jwtPlugin)
  .macro(({ onBeforeHandle }) => ({
    /**
     * Ensure the logged-in user has the right to view/edit the target user's data.
     * Rules:
     * 1. Admin can access anyone.
     * 2. User can access themselves.
     * 3. User can access another user IF there is a debt relationship between them.
     */
    ensureRelatedUser: (targetUserIdParamName: string = 'id') => {
      onBeforeHandle(async (context) => {
        const { user, params, set } = context as typeof context & {
          user: typeof users.$inferSelect | null;
          params: Record<string, string>;
        };

        if (!user) {
          set.status = 401;
          return { success: false, message: 'Unauthorized' };
        }

        const targetUserId = params[targetUserIdParamName];
        if (!targetUserId) return; // No parameter to check

        // 1. Admin Bypass
        if (user.role === 'admin') return;

        // 2. Self Access
        if (user.id === targetUserId) return;

        // 3. Relationship Check (Debt)
        // Check if there is ANY debt record where (debtor = user AND creditor = target) OR (debtor = target AND creditor = user)
        const relationship = await db.query.debts.findFirst({
          where: or(
            and(eq(debts.debtorId, user.id), eq(debts.creditorId, targetUserId)),
            and(eq(debts.debtorId, targetUserId), eq(debts.creditorId, user.id))
          )
        });

        if (relationship) return; // Found a relationship, allow access

        // No relationship found
        set.status = 403;
        return {
          success: false,
          message: 'Forbidden: You do not have permission to view this user.',
          code: 'ACCESS_DENIED_NO_RELATIONSHIP'
        };
      });
    },

    /**
     * Ensure the user is part of the Debt (either debtor or creditor) OR is Admin.
     */
    ensureRelatedDebt: (debtIdParamName: string = 'id') => {
      onBeforeHandle(async (context) => {
        const { user, params, set } = context as typeof context & {
          user: typeof users.$inferSelect | null;
          params: Record<string, string>;
        };

        if (!user) {
          set.status = 401;
          return { success: false, message: 'Unauthorized' };
        }

        if (user.role === 'admin') return;

        const debtId = params[debtIdParamName];
        if (!debtId) return;

        const debt = await db.query.debts.findFirst({
          where: eq(debts.id, debtId)
        });

        if (!debt) {
          set.status = 404;
          return { success: false, message: 'Debt not found' };
        }

        // Check if user is involved
        if (debt.debtorId !== user.id && debt.creditorId !== user.id) {
          set.status = 403;
          return {
            success: false,
            message: 'Forbidden: You are not a party to this debt.',
            code: 'ACCESS_DENIED_DEBT'
          };
        }
      });
    }
  }));
