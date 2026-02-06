/**
 * Bank Controller
 *
 * Handles bank account management and VietQR integration.
 */
import { Elysia, t } from 'elysia';
import { permissionPlugin } from '@plugins/permission';
import { PERMISSIONS } from '@repo/permissions';
import { bankAccountService, vietqrService } from '@/services';
import { insertBankAccountSchema } from '@repo/db';

export const bankController = new Elysia({ prefix: '/banks' })
  .use(permissionPlugin)

  // ==================== GET SUPPORTED BANKS ====================
  // Publicly accessible or authenticated? Let's make it authenticated for now to prevent abuse
  .get(
    '/list',
    async () => {
      const banks = await vietqrService.getBanks();
      return { success: true, banks };
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
    async ({ user }) => {
      const accounts = await bankAccountService.getUserBankAccounts(user!.id);
      return { success: true, accounts };
    },
    {
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN // Reusing basic permission
    }
  )

  // ==================== ADD ACCOUNT ====================
  .post(
    '/me',
    async ({ user, body, set }) => {
      const result = await bankAccountService.addBankAccount({
        ...body,
        userId: user!.id
      });

      if (!result.success) {
        set.status = 400;
        return result;
      }

      return { success: true, account: result.account };
    },
    {
      body: insertBankAccountSchema,
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  )

  // ==================== GET USER ACCOUNTS (Public/Shared) ====================
  // Used for debtors to see creditor's bank info
  .get(
    '/user/:userId',
    async ({ params: { userId } }) => {
      // In a strict system, we'd check if requestor has a debt with userId.
      // For now, we allow seeing bank accounts if you know the userId (needed for QR gen)
      const accounts = await bankAccountService.getUserBankAccounts(userId);
      // Only return necessary info
      return {
        success: true,
        accounts: accounts.map((a) => ({
          id: a.id,
          bankCode: a.bankCode,
          bankName: a.bankName,
          bankBin: a.bankBin,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          isDefault: a.isDefault
        }))
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN // Basic auth required
    }
  )

  // ==================== DELETE ACCOUNT ====================
  .delete(
    '/:id',
    async ({ user, params: { id }, set }) => {
      const result = await bankAccountService.deleteBankAccount(id, user!.id);

      if (!result.success) {
        set.status = 404;
        return result;
      }

      return { success: true, message: 'Bank account deleted' };
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.DEBT_CREATE
    }
  );
