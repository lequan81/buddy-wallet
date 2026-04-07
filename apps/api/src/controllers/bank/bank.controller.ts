/**
 * Bank Controller
 *
 * Handles bank account management and VietQR integration.
 */
import { Elysia, t } from 'elysia';
import { UpdateBankAccountSchema } from '@repo/schemas';
import { BE_ERRORS, apiResponse } from '@repo/errors';
import { PERMISSIONS } from '@repo/permissions';
import { insertBankAccountSchema } from '@repo/db';
import { getClientIP } from '@utils';
import { permissionPlugin, servicesPlugin, sessionAuthPlugin } from '@plugins';
import { isFailureResult, respondFailure } from '@/core/http/result-helper';
import { resolveActor } from '@/core/http/response.helpers';
import { BANK_ERROR_MAP, DEFAULT_BANK_FAILURE } from '@/core/http/error-maps/bank.error-map';

export const BankController = new Elysia({ prefix: '/banks' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(permissionPlugin)

  // ==================== GET SUPPORTED BANKS ====================
  .get(
    '/list',
    async ({ vietqrService }) => {
      const banks = await vietqrService.getBanks();
      return apiResponse({ ok: true, data: { banks } });
    },
    {
      detail: {
        summary: 'Get list of supported banks from VietQR'
      }
    }
  )

  // ==================== LIST MY ACCOUNTS ====================
  .get(
    '/me',
    async ({ user, set, bankAccountService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;

      const accounts = await bankAccountService.getUserBankAccounts(resolved.user.id);
      return apiResponse({ ok: true, data: { accounts } });
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN
    }
  )

  // ==================== ADD ACCOUNT ====================
  .post(
    '/me',
    async ({ user, body, set, request, server, bankAccountService, activityService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const result = await bankAccountService.addBankAccount({
        ...body,
        userId: freshUser.id
      });

      if (isFailureResult(result)) {
        return respondFailure(set, result, {
          map: BANK_ERROR_MAP,
          fallback: DEFAULT_BANK_FAILURE
        });
      }

      await activityService.log({
        userId: freshUser.id,
        action: 'create',
        resource: 'bank_account',
        resourceId: result.account?.id,
        metadata: { bankCode: body.bankCode, bankName: body.bankName },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return apiResponse({ ok: true, data: { account: result.account } });
    },
    {
      body: insertBankAccountSchema,
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  )

  // ==================== UPDATE ACCOUNT ====================
  .patch(
    '/:id',
    async ({ user, params: { id }, body, set, request, server, bankAccountService, activityService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const result = await bankAccountService.updateBankAccount(id, freshUser.id, body as Record<string, unknown>);

      if (isFailureResult(result)) {
        return respondFailure(set, result, {
          map: BANK_ERROR_MAP,
          fallback: DEFAULT_BANK_FAILURE
        });
      }

      await activityService.log({
        userId: freshUser.id,
        action: 'update',
        resource: 'bank_account',
        resourceId: id,
        metadata: { updates: body },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return apiResponse({ ok: true, data: { account: result.account } });
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateBankAccountSchema,
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  )

  // ==================== GET USER ACCOUNTS (Public/Shared) ====================
  .get(
    '/user/:userId',
    async ({ params: { userId }, bankAccountService }) => {
      const accounts = await bankAccountService.getUserBankAccounts(userId);
      return apiResponse({
        ok: true,
        data: {
          accounts: accounts.map((a) => ({
            id: a.id,
            bankCode: a.bankCode,
            bankName: a.bankName,
            bankBin: a.bankBin,
            accountNumber: a.accountNumber,
            accountName: a.accountName,
            isDefault: a.isDefault
          }))
        }
      });
    },
    {
      params: t.Object({ userId: t.String() }),
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN
    }
  )

  // ==================== GENERATE PAYMENT QR ====================
  .get(
    '/qr/:debtId',
    async ({ user, params: { debtId }, set, debtService, bankAccountService, vietqrService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const debt = await debtService.getDebtById(debtId);
      if (!debt) {
        set.status = 404;
        return apiResponse({ ok: false, error: BE_ERRORS.DEBT_NOT_FOUND });
      }

      if (debt.debtorId !== freshUser.id && debt.creditorId !== freshUser.id) {
        set.status = 403;
        return apiResponse({ ok: false, error: BE_ERRORS.DEBT_PERMISSION_DENIED });
      }

      if (!debt.creditorId) {
        set.status = 400;
        return apiResponse({
          ok: false,
          error: BE_ERRORS.DEBT_NOT_FOUND,
          details: 'Debt has no creditor assigned'
        });
      }
      
      const accounts = await bankAccountService.getUserBankAccounts(debt.creditorId);
      const defaultAccount = accounts.find((a: typeof accounts[0]) => a.isDefault) || accounts[0];

      if (!defaultAccount) {
        set.status = 400;
        return apiResponse({
          ok: false,
          error: BE_ERRORS.BANK_ACCOUNT_NOT_FOUND,
          details: 'Creditor has no bank account linked'
        });
      }

      const qrUrl = vietqrService.generateDebtPaymentQR({
        bankBin: defaultAccount.bankBin,
        accountNumber: defaultAccount.accountNumber,
        accountName: defaultAccount.accountName || '',
        amount: debt.amount,
        debtId: debt.id
      });

      return apiResponse({ ok: true, data: { qrUrl } });
    },
    {
      params: t.Object({ debtId: t.String() }),
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN
    }
  )

  // ==================== DELETE ACCOUNT ====================
  .delete(
    '/:id',
    async ({ user, params: { id }, set, request, server, bankAccountService, activityService }) => {
      const resolved = await resolveActor(user, set);
      if (!resolved.ok) return resolved.error;
      const { user: freshUser } = resolved;

      const result = await bankAccountService.deleteBankAccount(id, freshUser.id);

      if (isFailureResult(result)) {
        return respondFailure(set, result, {
          map: BANK_ERROR_MAP,
          fallback: DEFAULT_BANK_FAILURE
        });
      }

      await activityService.log({
        userId: freshUser.id,
        action: 'delete',
        resource: 'bank_account',
        resourceId: id,
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return apiResponse({ ok: true, data: { message: 'Bank account deleted' } });
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  );
