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
import { DebtService, ActivityService } from '../services';
import { getClientIP } from '../utils';

// Helper functions to convert responses to Response objects for Elysia
const createErrorResponse = (error: { code: string; message: string }, details?: string, status: number = 400) => {
  return new Response(JSON.stringify(errorResponse(error, details)), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
};

const createSuccessResponse = <T extends object>(data?: T, status: number = 200) => {
  return new Response(JSON.stringify(successResponse(data)), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
};

const DebtStatusSchema = t.Union([
  t.Literal('pending'),
  t.Literal('confirmed'),
  t.Literal('paid'),
  t.Literal('disputed'),
  t.Literal('cancelled')
]);

const NullableString = t.Union([t.String(), t.Null()]);
const NullableNumber = t.Union([t.Number(), t.Null()]);
const NullableDateString = t.Union([t.String(), t.Null()]);

// Error response schema for Elysia
const ErrorResponseSchema = t.Object({
  success: t.Literal(false),
  error: t.Object({
    code: t.String(),
    message: t.String(),
    details: t.Optional(t.String())
  })
});

const DebtSchema = t.Object({
  id: t.String(),
  debtorPhone: t.String(),
  creditorPhone: t.String(),
  debtorId: NullableString,
  creditorId: NullableString,
  uploadedById: t.String(),
  amount: t.Number(),
  description: NullableString,
  status: DebtStatusSchema,
  confirmedByCreditor: t.Boolean(),
  confirmedByDebtor: t.Boolean(),
  needsConfirmation: t.Boolean(),
  creditorConfirmedAt: NullableDateString,
  debtorConfirmedAt: NullableDateString,
  hasPendingProof: t.Boolean(),
  proofCount: t.Number(),
  lastProofUploadedAt: NullableDateString,
  expiresAt: NullableDateString,
  suggestedAmount: NullableNumber,
  suggestedDescription: NullableString,
  suggestedById: NullableString,
  suggestedAt: NullableDateString,
  createdAt: t.String(),
  updatedAt: t.String(),
  deletedAt: NullableDateString
});

const PaginationSchema = t.Object({
  total: t.Number(),
  limit: t.Number(),
  offset: t.Number(),
  hasMore: t.Boolean()
});

const DebtListResponseSchema = t.Object({
  success: t.Literal(true),
  debts: t.Array(DebtSchema),
  pagination: PaginationSchema
});

const RecentDebtSchema = t.Object({
  id: t.String(),
  description: NullableString,
  amount: t.String(),
  phone: t.String(),
  createdAt: t.String()
});

const RecentDebtsResponseSchema = t.Object({
  success: t.Literal(true),
  debts: t.Array(RecentDebtSchema)
});

const DebtResponseSchema = t.Object({
  success: t.Literal(true),
  debt: DebtSchema
});

const RecentContactsResponseSchema = t.Object({
  success: t.Literal(true),
  contacts: t.Array(t.String())
});

const DeleteAllResponseSchema = t.Object({
  success: t.Literal(true),
  message: t.String(),
  deleted: t.Number()
});

export const DebtsController = new Elysia({ prefix: '/debts' })
  .use(permissionPlugin)
  .use(accessControlPlugin)
  // Apply standard rate limit (100 req/min) for all debt endpoints
  .use(standardRateLimiter)

  // List debts (own or all for admin) with pagination
  .get(
    '/',
    async ({ user, permissions, query, set }) => {
      if (!user) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, undefined, 401);
      }
      const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
      const limit = query.limit ? Math.min(parseInt(query.limit), 100) : 50;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const status = query.status || undefined;

      const result = await DebtService.getDebtsForUser(user!.id, hasViewAll, {
        limit,
        offset,
        status
      });

      return createSuccessResponse({
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
      }),
      response: {
        200: DebtListResponseSchema,
        401: ErrorResponseSchema
      }
    }
  )

  // Get recent debts for quick actions
  .get(
    '/recent',
    async ({ user, permissions, set }) => {
      if (!user) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const hasViewAll = hasPermission(permissions, PERMISSIONS.DEBT_VIEW_ALL);
      const result = await DebtService.getDebtsForUser(user!.id, hasViewAll, {
        limit: 5,
        offset: 0
      });

      // Return simplified recent debt data
      const recentDebts = result.data.map(debt => ({
        id: debt.id,
        description: debt.description,
        amount: debt.amount.toString(),
        phone: debt.debtorPhone || debt.creditorPhone || '',
        createdAt: debt.createdAt
      }));

      return createSuccessResponse({ debts: recentDebts });
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN,
      response: { 200: RecentDebtsResponseSchema, 401: ErrorResponseSchema }
    }
  )

  // Admin: Get specific user's debts with pagination
  .get(
    '/user/:userId',
    async ({ params: { userId }, query }) => {
      const limit = query.limit ? Math.min(parseInt(query.limit), 100) : 50;
      const offset = query.offset ? parseInt(query.offset) : 0;
      const status = query.status || undefined;

      const result = await DebtService.getDebtsByUserId(userId, {
        limit,
        offset,
        status
      });

      return createSuccessResponse({
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
      checkPermission: PERMISSIONS.DEBT_VIEW_ALL,
      response: { 200: DebtListResponseSchema, 401: ErrorResponseSchema }
    }
  )

  // Get recent contacts (phone numbers user has interacted with)
  .get(
    '/recent-contacts',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const contacts = await DebtService.getRecentContacts(user.id, 10);
      return createSuccessResponse({ contacts });
    },
    { checkPermission: PERMISSIONS.DEBT_VIEW_OWN, response: { 200: RecentContactsResponseSchema, 401: ErrorResponseSchema } }
  )

  // Get single debt by ID
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
      const debt = await DebtService.getDebtById(id);
      if (!debt) {
        set.status = 404;
        return createErrorResponse(BE_ERRORS.DEBT_NOT_FOUND);
      }
      return createSuccessResponse({ debt });
    },
    {
      params: t.Object({ id: t.String() }),
      ensureRelatedDebt: 'id',
      response: { 200: DebtResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema }
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
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await DebtService.createDebt(
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
          return createErrorResponse({
            code: result.code || 'DUPLICATE_WARNING',
            message: result.error || 'Duplicate debts detected'
          }, undefined, 409);
        }
        set.status = 400;
        return createErrorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return createSuccessResponse({ debt: result.debt });
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
      checkPermission: PERMISSIONS.DEBT_CREATE,
      response: { 200: DebtResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 409: ErrorResponseSchema }
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
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await DebtService.updateDebtStatus(id, body.status, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return createErrorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return createErrorResponse(BE_ERRORS.DEBT_INVALID_STATUS, result.error);
      }

      return createSuccessResponse({ debt: result.debt });
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
    async ({ user, params: { id }, body, set }) => {
      const freshUser = await getUserWithFreshData(user!.id);
      if (!freshUser) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await DebtService.updateDebt(id, body, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return createErrorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return createErrorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return createSuccessResponse({ debt: result.debt });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        description: t.Optional(t.String({ maxLength: 500 })),
        amount: t.Optional(t.Number({ minimum: 1 }))
      }),
      checkPermission: PERMISSIONS.DEBT_UPDATE_OWN,
      ensureRelatedDebt: 'id',
      response: { 200: DebtResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema }
    }
  )

  // Batch delete debts (must be before /:id to avoid route conflict)
  .delete(
    '/batch',
    async ({ user, body, set, request, server }) => {
      const freshUser = await getUserWithFreshData(user!.id);
      if (!freshUser) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      if (body.ids.length > 50) {
        set.status = 400;
        return createErrorResponse(GEN_ERRORS.INVALID_INPUT, 'Cannot delete more than 50 debts at once');
      }

      const result = await DebtService.deleteDebts(body.ids, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      // Log the batch delete activity
      if (result.deleted > 0) {
        await ActivityService.log({
          userId: freshUser.id,
          action: 'delete',
          resource: 'debt',
          metadata: { deletedCount: result.deleted, ids: body.ids },
          ipAddress: getClientIP(request, server) || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }

      return createSuccessResponse({
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
    async ({ user, query, set, request, server }) => {
      if (!user) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      if (query.confirm !== 'true') {
        set.status = 400;
        return createErrorResponse(GEN_ERRORS.INVALID_INPUT, 'Must confirm deletion with ?confirm=true');
      }

      const result = await DebtService.deleteAllDebts(user.id);

      // Log the delete all activity
      if (result.deleted > 0) {
        await ActivityService.log({
          userId: user!.id,
          action: 'delete_all',
          resource: 'debt',
          metadata: { deletedCount: result.deleted },
          ipAddress: getClientIP(request, server) || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }

      return createSuccessResponse({
        message: 'All debts deleted successfully',
        deleted: result.deleted
      });
    },
    {
      query: t.Object({
        confirm: t.String()
      }),
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN,
      response: { 200: DeleteAllResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema }
    }
  )

  // Delete single debt (soft delete)
  .delete(
    '/:id',
    async ({ user, params: { id }, set }) => {
      const freshUser = await getUserWithFreshData(user!.id);
      if (!freshUser) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await DebtService.deleteDebt(id, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      if (!result.success) {
        if (result.error === 'Debt not found') {
          set.status = 404;
          return createErrorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        set.status = 400;
        return createErrorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return createSuccessResponse({ message: 'Debt deleted successfully' });
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.DEBT_DELETE_OWN,
      ensureRelatedDebt: 'id',
      response: { 200: t.Object({ success: t.Literal(true), message: t.String() }), 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema }
    }
  )

  // Confirm debt by counterparty
  .post(
    '/:id/confirm',
    async ({ user, params: { id }, set }) => {
      const freshUser = await getUserWithFreshData(user!.id);
      if (!freshUser) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await DebtService.confirmDebt(id, {
        id: freshUser.id,
        phoneNumber: freshUser.phoneNumber,
        permissions: freshUser.permissions as string[],
        role: freshUser.role,
        email: freshUser.email
      });

      if (!result.success) {
        if (result.code === 'NOT_FOUND') {
          set.status = 404;
          return createErrorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        if (result.code === 'FORBIDDEN') {
          set.status = 403;
          return createErrorResponse(GEN_ERRORS.FORBIDDEN, result.error);
        }
        if (result.code === 'ALREADY_CONFIRMED') {
          return createSuccessResponse({ message: result.error });
        }
        set.status = 400;
        return createErrorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      return createSuccessResponse({ debt: result.debt, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      ensureRelatedDebt: 'id',
      response: { 200: DebtResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 403: ErrorResponseSchema, 404: ErrorResponseSchema }
    }
  )

  // Suggest edit to a debt (counterparty only)
  .post(
    '/:id/suggest',
    async ({ user, params: { id }, body, set, request, server }) => {
      const freshUser = await getUserWithFreshData(user!.id);
      if (!freshUser) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await DebtService.suggestEdit(
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
          return createErrorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        if (result.code === 'FORBIDDEN') {
          set.status = 403;
          return createErrorResponse(GEN_ERRORS.FORBIDDEN, result.error);
        }
        set.status = 400;
        return createErrorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      await ActivityService.log({
        userId: freshUser.id,
        action: 'suggest_edit',
        resource: 'debt',
        resourceId: id,
        changes: { after: body },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return createSuccessResponse({ debt: result.debt, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        amount: t.Optional(t.Number({ minimum: 1 })),
        description: t.Optional(t.String({ maxLength: 500 }))
      }),
      ensureRelatedDebt: 'id',
      response: { 200: DebtResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 403: ErrorResponseSchema, 404: ErrorResponseSchema }
    }
  )

  // Respond to suggested edit (creator only)
  .post(
    '/:id/suggestion/respond',
    async ({ user, params: { id }, body, set, request, server }) => {
      const freshUser = await getUserWithFreshData(user!.id);
      if (!freshUser) {
        set.status = 401;
        return createErrorResponse(GEN_ERRORS.UNAUTHORIZED, 'User not found');
      }

      const result = await DebtService.respondToSuggestion(
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
          return createErrorResponse(BE_ERRORS.DEBT_NOT_FOUND);
        }
        if (result.code === 'FORBIDDEN') {
          set.status = 403;
          return createErrorResponse(GEN_ERRORS.FORBIDDEN, result.error);
        }
        set.status = 400;
        return createErrorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      await ActivityService.log({
        userId: freshUser.id,
        action: body.accept ? 'accept_suggestion' : 'reject_suggestion',
        resource: 'debt',
        resourceId: id,
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return createSuccessResponse({ debt: result.debt, message: result.message });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        accept: t.Boolean()
      }),
      ensureRelatedDebt: 'id',
      response: { 200: DebtResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 403: ErrorResponseSchema, 404: ErrorResponseSchema }
    }
  );
