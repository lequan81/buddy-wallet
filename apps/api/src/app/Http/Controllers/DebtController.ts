import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { apiSuccess, apiError, BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import {
  accessControlPlugin,
  permissionPlugin,
  containerPlugin,
  sessionAuthPlugin
} from '@/lib/plugins';
import { standardRateLimiter } from '@/app/Http/Middlewares';
import { PERMISSIONS, hasPermission } from '@/lib/security/permissions';
import {
  DebtQuerySchema,
  CreateDebtSchema,
  UpdateDebtStatusSchema,
  UpdateDebtSchema,
  SuggestDebtEditSchema,
  DeleteBatchDebtSchema,
  RecentDebtsResponseSchema
} from '@repo/schema';
import { getClientIP } from '@lib/http/ip';
import { logger } from '@repo/logger';
import { parseOffsetPagination, requireAuth, respondFailure } from '@/lib/http';
import { DEFAULT_DEBT_FAILURE, DEBT_ERROR_MAP, getIdempotencyKey, setIdempotencyHeaders, getIdempotentResponse, storeIdempotentResponse } from '@/lib/http';
import { resolveActor } from '@/lib/http';
import { DebtService } from '@/app/Services/DebtService';
import { ActivityService } from '@/app/Services/ActivityService';

const respondDebtFailure = (set: { status?: number | string }, result: { success: boolean; error?: string; code?: string }) => {
  return respondFailure(set, result as any, {
    map: DEBT_ERROR_MAP,
    fallback: DEFAULT_DEBT_FAILURE
  });
};

@injectable()
export class DebtController {
  constructor(
    @inject(DebtService) private debtService: DebtService,
    @inject(ActivityService) private activityService: ActivityService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/debts', (group) =>
      group
        .use(containerPlugin)
        .use(sessionAuthPlugin)
        .use(permissionPlugin)
        .use(accessControlPlugin)
        .use(standardRateLimiter)

        .get(
          '/',
          async (ctx) => {
            const { user, permissions, query, set } = ctx;
            const auth = requireAuth(user, set);
            if ('error' in auth) {
              set.status = 401;
              return auth.error;
            }

            const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
            const { limit, offset } = parseOffsetPagination(query);
            const status = (query.status as any) || undefined;

            const result = await this.debtService.getDebts(auth.user.id, {
              limit,
              offset,
              status,
              viewAll: hasViewAll
            });

            return apiSuccess(result);
          },
          {
            checkPermission: PERMISSIONS.DEBT_VIEW_OWN,
            query: DebtQuerySchema
          }
        )

        // Get recent debts for quick actions
        .get(
          '/recent',
          async ({ user, permissions, set }) => {
            const auth = requireAuth(user, set);
            if ('error' in auth) {
              set.status = 401;
              return auth.error;
            }
            const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
            const result = await this.debtService.getDebts(auth.user.id, {
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

            return apiSuccess({ data: recentDebts });
          },
          {
            checkPermission: PERMISSIONS.DEBT_VIEW_OWN,
            response: {
              200: RecentDebtsResponseSchema
            }
          }
        )

        // Admin: Get specific user's debts with pagination
        .get(
          '/user/:userId',
          async ({ params: { userId }, query }) => {
            const { limit, offset } = parseOffsetPagination(query);
            const status = (query.status as any) || undefined;

            const result = await this.debtService.getDebts(userId, {
              limit,
              offset,
              status
            });

            return apiSuccess(result);
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
          async ({ user, set }) => {
            const auth = requireAuth(user, set);
            if ('error' in auth) {
              return auth.error;
            }
            const contacts = await this.debtService.getRecentContacts(auth.user.id, 10);
            return apiSuccess({ contacts });
          },
          { checkPermission: PERMISSIONS.DEBT_VIEW_OWN }
        )

        // Get single debt by ID
        .get(
          '/:id',
          async (ctx) => {
            const { params: { id }, set } = ctx;
            const debt = await this.debtService.getDebtById(id);
            if (!debt) {
              set.status = 404;
              return apiError(BE_ERRORS.DEBT_NOT_FOUND);
            }
            return apiSuccess({ debt });
          },
          {
            params: t.Object({ id: t.String() })
          }
        )

        // Create new debt (with idempotency support)
        .post(
          '/',
          async ({ body, user, set, headers }) => {
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
                  return apiSuccess({ debt: cached.debt });
                }
                return cached.error;
              }
            }

            const result = await this.debtService.createDebt(
              {
                amount: body.amount,
                description: body.description,
                counterpartyPhone: body.counterpartyPhone,
                direction: body.direction
              },
              actor,
              {
                expiryOption: body.expiryOption as any,
                confirmDuplicate: body.confirmDuplicate
              }
            );

            if ('code' in result) {
              const error = respondDebtFailure(set, result as any);
              if (idempotencyKey) {
                await storeIdempotentResponse(idempotencyKey, { success: false, error });
                setIdempotencyHeaders(set, idempotencyKey);
              }
              return error;
            }

            const response = { debt: result.data.debt };
            if (idempotencyKey) {
              await storeIdempotentResponse(idempotencyKey, { success: true, debt: result.data.debt });
              setIdempotencyHeaders(set, idempotencyKey);
            }

            return apiSuccess(response);
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
            const { params: { id }, body, user, set } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { actor } = resolved;

            const result = await this.debtService.updateDebtStatus(id, body.status as any, actor);

            if ('code' in result) {
              return respondDebtFailure(set, result as any);
            }

            return apiSuccess({ debt: result.data.debt });
          },
          {
            params: t.Object({ id: t.String() }),
            body: UpdateDebtStatusSchema
          }
        )

        // Update debt details (description/amount)
        .put(
          '/:id',
          async (ctx) => {
            const { params: { id }, body, user, set } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { actor } = resolved;

            const result = await this.debtService.updateDebt(id, body, actor);

            if ('code' in result) {
              return respondDebtFailure(set, result as any);
            }

            return apiSuccess({ debt: result.data.debt });
          },
          {
            params: t.Object({ id: t.String() }),
            body: UpdateDebtSchema,
            checkPermission: PERMISSIONS.DEBT_UPDATE_OWN
          }
        )

        // Batch delete debts
        .delete(
          '/batch',
          async ({ body, user, set, request, server }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { actor, user: freshUser } = resolved;

            if (body.ids.length > 50) {
              set.status = 400;
              return apiError(GEN_ERRORS.INVALID_INPUT, 'Cannot delete more than 50 debts at once');
            }

            const result = await this.debtService.deleteDebts(body.ids, actor);

            if (result.deleted > 0) {
              await this.activityService.log({
                userId: freshUser.id,
                action: 'delete',
                resource: 'debt',
                metadata: { deletedCount: result.deleted, ids: body.ids },
                ipAddress: getClientIP(request, server) || undefined,
                userAgent: request.headers.get('user-agent') || undefined
              });
            }

            return apiSuccess({
              deleted: result.deleted,
              errors: result.errors
            });
          },
          {
            body: DeleteBatchDebtSchema,
            checkPermission: PERMISSIONS.DEBT_DELETE_OWN
          }
        )

        // Delete all user's debts
        .delete(
          '/all',
          async ({ user, query, set, request, server }) => {
            const auth = requireAuth(user, set);
            if ('error' in auth) {
                return auth.error;
            }
            
            if (query.confirm !== 'true') {
              set.status = 400;
              return apiError(GEN_ERRORS.INVALID_INPUT, 'Must confirm deletion with ?confirm=true');
            }

            const result = await this.debtService.deleteAllDebts(auth.user.id);

            if (result.deleted > 0) {
              await this.activityService.log({
                userId: auth.user.id,
                action: 'delete_all',
                resource: 'debt',
                metadata: { deletedCount: result.deleted },
                ipAddress: getClientIP(request, server) || undefined,
                userAgent: request.headers.get('user-agent') || undefined
              });
            }

            return apiSuccess({
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

        // Delete single debt
        .delete(
          '/:id',
          async (ctx) => {
            const { params: { id }, user, set } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { actor } = resolved;

            const result = await this.debtService.deleteDebt(id, actor);

            if ('code' in result) {
              return respondDebtFailure(set, result as any);
            }

            return apiSuccess({ message: 'Debt deleted successfully' });
          },
          {
            params: t.Object({ id: t.String() }),
            checkPermission: PERMISSIONS.DEBT_DELETE_OWN
          }
        )

        // Confirm debt by counterparty
        .post(
          '/:id/confirm',
          async (ctx) => {
            const { params: { id }, user, set } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { actor } = resolved;

            const result = await this.debtService.confirmDebt(id, actor);

            if ('code' in result) {
              if (result.code === BE_ERRORS.DEBT_ALREADY_CONFIRMED.code) {
                return apiSuccess({
                  message: result.error || BE_ERRORS.DEBT_ALREADY_CONFIRMED.message
                });
              }
              return respondDebtFailure(set, result as any);
            }

            return apiSuccess({ debt: result.data.debt, message: result.data.message });
          },
          {
            params: t.Object({ id: t.String() })
          }
        )

        // Suggest edit to a debt
        .post(
          '/:id/suggest',
          async (ctx) => {
            const { params: { id }, body, user, set, request, server } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { actor, user: freshUser } = resolved;

            const result = await this.debtService.suggestEdit(id, actor, body);

            if ('code' in result) {
              return respondDebtFailure(set, result as any);
            }

            await this.activityService.log({
              userId: freshUser.id,
              action: 'suggest_edit',
              resource: 'debt',
              resourceId: id,
              changes: { after: body },
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ debt: result.data.debt, message: result.data.message });
          },
          {
            params: t.Object({ id: t.String() }),
            body: SuggestDebtEditSchema
          }
        )

        // Respond to suggested edit
        .post(
          '/:id/suggestion/respond',
          async (ctx) => {
            const { params: { id }, body, user, set, request, server } = ctx;
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { actor, user: freshUser } = resolved;

            const result = await this.debtService.respondToSuggestion(id, actor, body.accept);

            if ('code' in result) {
              return respondDebtFailure(set, result as any);
            }

            await this.activityService.log({
              userId: freshUser.id,
              action: body.accept ? 'accept_suggestion' : 'reject_suggestion',
              resource: 'debt',
              resourceId: id,
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ debt: result.data.debt, message: result.data.message });
          },
          {
            params: t.Object({ id: t.String() }),
            body: t.Object({ accept: t.Boolean() })
          }
        )
    );
  }
}
