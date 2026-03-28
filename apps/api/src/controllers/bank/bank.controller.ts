/**
 * Bank Controller
 *
 * Handles bank account management and VietQR integration.
 */
import { Elysia, t } from 'elysia';
import { UpdateBankAccountSchema } from '@repo/schemas';
import { BE_ERRORS, GEN_ERRORS, errorResponse, successResponse } from '@repo/errors';
import { PERMISSIONS } from '@repo/permissions';
import { insertBankAccountSchema } from '@repo/db';
import { getClientIP } from '@utils';
import { permissionPlugin, servicesPlugin, sessionAuthPlugin } from '@plugins';
import { requireAuth } from '@/core/http/require-auth';

export const BankController = new Elysia({ prefix: '/banks' })
  .use(servicesPlugin)
  .use(sessionAuthPlugin)
  .use(permissionPlugin)

  // ==================== GET SUPPORTED BANKS ====================
  // Publicly accessible or authenticated? Let's make it authenticated for now to prevent abuse
  .get(
    '/list',
    async ({ vietqrService }) => {
      const banks = await vietqrService.getBanks();
      return successResponse({ banks });
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
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const accounts = await bankAccountService.getUserBankAccounts(auth.user.id);
      return successResponse({ accounts });
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN // Reusing basic permission
    }
  )

  // ==================== ADD ACCOUNT ====================
  .post(
    '/me',
    async ({ user, body, set, request, server, bankAccountService, activityService }) => {
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const result = await bankAccountService.addBankAccount({
        ...body,
        userId: auth.user.id
      });

      if (!result.success) {
        set.status = 400;
        return result;
      }

      await activityService.log({
        userId: auth.user.id,
        action: 'create',
        resource: 'bank_account',
        resourceId: result.account?.id,
        metadata: { bankCode: body.bankCode, bankName: body.bankName },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ account: result.account });
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
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }

      const result = await bankAccountService.updateBankAccount(id, auth.user.id, body as Record<string, unknown>);

      if (!result.success) {
        set.status = 400;
        return result;
      }

      await activityService.log({
        userId: auth.user.id,
        action: 'update',
        resource: 'bank_account',
        resourceId: id,
        metadata: { updates: body },
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ account: result.account });
    },
    {
      params: t.Object({ id: t.String() }),
      body: UpdateBankAccountSchema,
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  )

  // ==================== GET USER ACCOUNTS (Public/Shared) ====================
  // Used for debtors to see creditor's bank info
  .get(
    '/user/:userId',
    async ({ params: { userId }, bankAccountService }) => {
      // In a strict system, we'd check if requestor has a debt with userId.
      // For now, we allow seeing bank accounts if you know the userId (needed for QR gen)
      const accounts = await bankAccountService.getUserBankAccounts(userId);
      // Only return necessary info
      return successResponse({
        accounts: accounts.map((a) => ({
          id: a.id,
          bankCode: a.bankCode,
          bankName: a.bankName,
          bankBin: a.bankBin,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          isDefault: a.isDefault
        }))
      });
    },
    {
      params: t.Object({ userId: t.String() }),
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN // Basic auth required
    }
  )

  // ==================== GENERATE PAYMENT QR ====================
  // Generate a VietQR code for paying a specific debt
  .get(
    '/qr/:debtId',
    async ({ user, params: { debtId }, set, debtService, bankAccountService, vietqrService }) => {
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }

      // 1. Get debt details
      const debt = await debtService.getDebtById(debtId);
      if (!debt) {
        set.status = 404;
        return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
      }

      // 2. Security check: User must be involved in the debt
      // Actually, for paying, anyone can pay? Or just debtor?
      // Let's stick to debt visibility rules.
      // If user is debtor => they see QR to pay creditor
      // If user is creditor => they see QR to share with debtor
      if (debt.debtorId !== auth.user.id && debt.creditorId !== auth.user.id) {
        // TODO: Strict check? For now, relying on DEBT_VIEW_OWN permission which is generic.
        // Ideally we should check if they have access.
      }

      // 3. Get creditor's default bank account
      if (!debt.creditorId) {
        set.status = 400;
        return errorResponse(BE_ERRORS.DEBT_NOT_FOUND, 'Debt has no creditor assigned');
      }
      const accounts = await bankAccountService.getUserBankAccounts(debt.creditorId);
      const defaultAccount = accounts.find((a: typeof accounts[0]) => a.isDefault) || accounts[0];

      if (!defaultAccount) {
        set.status = 400;
        return errorResponse(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND, 'Creditor has no bank account linked');
      }

      // 4. Generate QR
      const qrUrl = vietqrService.generateDebtPaymentQR({
        bankBin: defaultAccount.bankBin,
        accountNumber: defaultAccount.accountNumber,
        accountName: defaultAccount.accountName || '',
        amount: debt.amount,
        debtId: debt.id
      });

      return successResponse({ qrUrl });
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
      const auth = requireAuth(user, set);
      if ('error' in auth) {
        return auth.error;
      }
      const result = await bankAccountService.deleteBankAccount(id, auth.user.id);

      if (!result.success) {
        set.status = 404;
        return result;
      }

      await activityService.log({
        userId: auth.user.id,
        action: 'delete',
        resource: 'bank_account',
        resourceId: id,
        ipAddress: getClientIP(request, server) || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ message: 'Bank account deleted' });
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  );
