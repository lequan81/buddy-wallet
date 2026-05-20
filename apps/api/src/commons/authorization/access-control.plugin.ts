import { Elysia } from 'elysia';
import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import { apiError } from '@/commons/http/response';
import { logger } from '@repo/logger';
import { actor } from '@/plugins/auth';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import type { AccessControlContext } from '@repo/types/api';

/**
 * Access Control Plugin
 *
 * Provides macros for checking user permissions.
 */
const debtRepo = new DebtRepository();

export const accessControl = new Elysia({ name: 'Access_Control' })
  .use(actor)
  .macro(({ onBeforeHandle }) => ({
    /**
     * Ensure the logged-in user has the right to view/edit the target user's data.
     */
    ensureRelatedUser: (targetUserIdParamName: string = 'id') => {
      onBeforeHandle(async ({ actor, params, set }: AccessControlContext) => {
        if (!actor) {
          set.status = 401;
          return apiError(GEN_ERRORS.UNAUTHORIZED);
        }

        const targetUserId = params[targetUserIdParamName];
        if (!targetUserId) return;

        // 1. Admin Bypass
        if (actor.role === 'admin') return;

        // 2. Self Access
        if (actor.id === targetUserId) return;

        // 3. Relationship Check (Debt) - single EXISTS-style query
        const hasRelationship = await debtRepo.existsRelationship(actor.id, targetUserId);
        if (hasRelationship) return;

        logger.accessControl(`Denied: User ${actor.id} -> User ${targetUserId} (no relationship)`);
        set.status = 403;
        return apiError(GEN_ERRORS.FORBIDDEN, 'You do not have permission to view this user.');
      });
    },

    /**
     * Ensure the user is part of the Debt (either debtor or creditor) OR is Admin.
     */
    ensureRelatedDebt: (debtIdParamName: string = 'id') => {
      onBeforeHandle(async ({ actor, params, set }: AccessControlContext) => {
        if (!actor) {
          set.status = 401;
          return apiError(GEN_ERRORS.UNAUTHORIZED);
        }

        if (actor.role === 'admin') return;

        const debtId = params[debtIdParamName];
        if (!debtId) return;

        const debt = await debtRepo.findById(debtId);

        if (!debt) {
          set.status = 404;
          return apiError(BE_ERRORS.DEBT_NOT_FOUND);
        }

        if (debt.debtorId !== actor.id && debt.creditorId !== actor.id) {
          logger.accessControl(`Denied: User ${actor.id} not party to debt ${debtId}`);
          set.status = 403;
          return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
        }

        // Store debt in context for downstream use
        (params as unknown as Record<string, unknown>).relatedDebt = debt;
      });
    }
  }));

