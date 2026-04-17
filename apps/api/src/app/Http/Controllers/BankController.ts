import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { apiSuccess, apiError, BE_ERRORS } from '@repo/errors';
import { PERMISSIONS } from '@/lib/security/permissions';
import { insertBankAccountSchema } from '@repo/db';
import { getClientIP } from '@lib/http/ip';
import { UpdateBankAccountSchema } from '@repo/schema';
import { permissionPlugin, containerPlugin, sessionAuthPlugin } from '@/lib/plugins';
import { isFailureResult, respondFailure } from '@/lib/http';
import { resolveActor } from '@/lib/http';
import { BANK_ERROR_MAP, DEFAULT_BANK_FAILURE } from '@/lib/http/error-maps';
import { BankAccountService } from '@/app/Services/BankAccountService';
import { VietQRService } from '@/app/Services/VietQRService';
import { ActivityService } from '@/app/Services/ActivityService';
import { DebtService } from '@/app/Services/DebtService';

@injectable()
export class BankController {
  constructor(
    @inject(BankAccountService) private bankAccountService: BankAccountService,
    @inject(VietQRService) private vietqrService: VietQRService,
    @inject(ActivityService) private activityService: ActivityService,
    @inject(DebtService) private debtService: DebtService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/banks', (group) =>
      group
        .use(containerPlugin)
        .use(sessionAuthPlugin)
        .use(permissionPlugin)

        // ==================== GET SUPPORTED BANKS ====================
        .get(
          '/list',
          async () => {
            const banks = await this.vietqrService.getBanks();
            return apiSuccess({ banks });
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
          async ({ user, set }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;

            const result = await this.bankAccountService.getUserBankAccounts(resolved.user.id);
            if (isFailureResult(result)) {
              return respondFailure(set, result as any, {
                map: BANK_ERROR_MAP,
                fallback: DEFAULT_BANK_FAILURE
              });
            }

            return apiSuccess({ accounts: result.data });
          },
          {
            checkPermission: PERMISSIONS.DEBT_VIEW_OWN
          }
        )

        // ==================== ADD ACCOUNT ====================
        .post(
          '/me',
          async ({ user, body, set, request, server }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const result = await this.bankAccountService.addBankAccount({
              ...body,
              userId: freshUser.id
            } as any);

            if (isFailureResult(result)) {
              return respondFailure(set, result as any, {
                map: BANK_ERROR_MAP,
                fallback: DEFAULT_BANK_FAILURE
              });
            }

            const account = result.data;

            await this.activityService.log({
              userId: freshUser.id,
              action: 'create',
              resource: 'bank_account',
              resourceId: account.id,
              metadata: { bankCode: body.bankCode, bankName: body.bankName },
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ account });
          },
          {
            body: insertBankAccountSchema,
            checkPermission: PERMISSIONS.DEBT_CREATE
          }
        )

        // ==================== UPDATE ACCOUNT ====================
        .patch(
          '/:id',
          async ({ user, params: { id }, body, set, request, server }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const result = await this.bankAccountService.updateBankAccount(id, freshUser.id, body as any);

            if (isFailureResult(result)) {
              return respondFailure(set, result as any, {
                map: BANK_ERROR_MAP,
                fallback: DEFAULT_BANK_FAILURE
              });
            }

            const updatedAccount = result.data;

            await this.activityService.log({
              userId: freshUser.id,
              action: 'update',
              resource: 'bank_account',
              resourceId: id,
              metadata: { updates: body },
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ account: updatedAccount });
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
          async ({ params: { userId } }) => {
            const result = await this.bankAccountService.getUserBankAccounts(userId);
            if (isFailureResult(result)) {
              return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND);
            }

            const accounts = result.data;
            return apiSuccess({
              accounts: accounts.map((a: any) => ({
                id: a.id,
                bankCode: a.bankCode,
                bankName: a.bankName,
                bankBin: a.bankBin,
                accountNumber: a.accountNumber,
                accountName: a.accountName,
                isPrimary: a.isPrimary
              }))
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
          async ({ user, params: { debtId }, set }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const debt = await this.debtService.getDebtById(debtId);
            if (!debt) {
              set.status = 404;
              return apiError(BE_ERRORS.DEBT_NOT_FOUND);
            }

            if (debt.debtorId !== freshUser.id && debt.creditorId !== freshUser.id) {
              set.status = 403;
              return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
            }

            if (!debt.creditorId) {
              set.status = 400;
              return apiError(BE_ERRORS.DEBT_NOT_FOUND, 'Debt has no creditor assigned');
            }
            
            const result = await this.bankAccountService.getUserBankAccounts(debt.creditorId);
            if (isFailureResult(result)) {
              set.status = 400;
              return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND);
            }

            const accounts = result.data;
            const primaryAccount = accounts.find((a: any) => a.isPrimary) || accounts[0];

            if (!primaryAccount) {
              set.status = 400;
              return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND, 'Creditor has no bank account linked');
            }

            const qrUrl = this.vietqrService.generateDebtPaymentQR({
              bankBin: primaryAccount.bankBin,
              accountNumber: primaryAccount.accountNumber,
              accountName: primaryAccount.accountName || '',
              amount: debt.amount as any,
              debtId: debt.id
            });

            return apiSuccess({ qrUrl });
          },
          {
            params: t.Object({ debtId: t.String() }),
            checkPermission: PERMISSIONS.DEBT_VIEW_OWN
          }
        )

        // ==================== DELETE ACCOUNT ====================
        .delete(
          '/:id',
          async ({ user, params: { id }, set, request, server }) => {
            const resolved = await resolveActor(user, set);
            if (!resolved.ok) return resolved.error;
            const { user: freshUser } = resolved;

            const result = await this.bankAccountService.deleteBankAccount(id, freshUser.id);

            if (isFailureResult(result)) {
              return respondFailure(set, result as any, {
                map: BANK_ERROR_MAP,
                fallback: DEFAULT_BANK_FAILURE
              });
            }

            await this.activityService.log({
              userId: freshUser.id,
              action: 'delete',
              resource: 'bank_account',
              resourceId: id,
              ipAddress: getClientIP(request, server) || undefined,
              userAgent: request.headers.get('user-agent') || undefined
            });

            return apiSuccess({ message: 'Bank account deleted' });
          },
          {
            params: t.Object({ id: t.String() }),
            checkPermission: PERMISSIONS.DEBT_CREATE
          }
        )
    );
  }
}
