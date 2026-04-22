import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { BE_ERRORS } from '@repo/errors';
import { actor, permissionPlugin } from '@/app/Providers/Plugins';
import { PERMISSIONS } from '@/lib/security/permissions';
import { getClientIP } from '@/lib/http/ip';
import { UpdateBankAccountSchema } from '@repo/schema';
import { apiSuccess, apiError, isFailureResult } from '@/lib/http';
import { GetUserBankAccountsAction } from '@/app/Actions/Bank/GetUserBankAccountsAction';
import { AddBankAccountAction } from '@/app/Actions/Bank/AddBankAccountAction';
import { UpdateBankAccountAction } from '@/app/Actions/Bank/UpdateBankAccountAction';
import { DeleteBankAccountAction } from '@/app/Actions/Bank/DeleteBankAccountAction';
import { GetBanksAction } from '@/app/Actions/Bank/GetBanksAction';
import { GenerateDebtPaymentQRAction } from '@/app/Actions/Bank/GenerateDebtPaymentQRAction';
import { LogAction } from '@/app/Actions/System/LogAction';
import { GetDebtByIdAction } from '@/app/Actions/Debt/GetDebtByIdAction';
import type { AuthenticatedElysiaContext } from '@/types/elysia';

@injectable()
export class BankController {
  constructor(
    @inject(GetUserBankAccountsAction) private getUserBankAccountsAction: GetUserBankAccountsAction,
    @inject(AddBankAccountAction) private addBankAccountAction: AddBankAccountAction,
    @inject(UpdateBankAccountAction) private updateBankAccountAction: UpdateBankAccountAction,
    @inject(DeleteBankAccountAction) private deleteBankAccountAction: DeleteBankAccountAction,
    @inject(GetBanksAction) private getBanksAction: GetBanksAction,
    @inject(GenerateDebtPaymentQRAction) private generateDebtPaymentQRAction: GenerateDebtPaymentQRAction,
    @inject(LogAction) private logAction: LogAction,
    @inject(GetDebtByIdAction) private getDebtByIdAction: GetDebtByIdAction
  ) {}

  register(app: Elysia): any {
    return app.group('/banks', (group: any) =>
      group
        .use(actor)
        .use(permissionPlugin)

        // ==================== GET SUPPORTED BANKS ====================
        .get(
          '/list',
          async (ctx: any) => {
            const banks = await this.getBanksAction.execute();
            return apiSuccess({ banks });
          },
          {
            requireActor: false,
            detail: {
              summary: 'Get list of supported banks from VietQR'
            }
          }
        )

        // Require actor for all subsequent routes
        .group('', (bankGroup: any) =>
          bankGroup
            .requireActor(true)

            // ==================== LIST MY ACCOUNTS ====================
            .get(
              '/me',
              async (ctx: any) => {
                const { actor } = ctx as AuthenticatedElysiaContext;
                const result = await this.getUserBankAccountsAction.execute(actor!.id);
                if (isFailureResult(result)) {
                  return apiError({ code: result.code, message: result.error || 'Failed to fetch bank accounts' });
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
              async (ctx: any) => {
                const { actor, body, set, request, server } = ctx as AuthenticatedElysiaContext<any>;
                const result = await this.addBankAccountAction.execute({
                  ...body,
                  userId: actor!.id
                } as any);
 
                if (isFailureResult(result)) {
                  set.status = 400;
                  return apiError({ code: result.code, message: result.error || 'Failed to add bank account' });
                }
 
                const account = result.data;
 
                await this.logAction.execute({
                  userId: actor!.id,
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
                body: t.Object({
                  bankCode: t.String(),
                  bankName: t.String(),
                  bankBin: t.String(),
                  accountNumber: t.String(),
                  accountName: t.Optional(t.String()),
                  isDefault: t.Optional(t.Boolean())
                }),
                checkPermission: PERMISSIONS.DEBT_CREATE
              }
            )

            // ==================== UPDATE ACCOUNT ====================
            .patch(
              '/:id',
              async (ctx: any) => {
                const { actor, params: { id }, body, set, request, server } = ctx as AuthenticatedElysiaContext<any>;
                const result = await this.updateBankAccountAction.execute(id, actor!.id, body as any);
 
                if (isFailureResult(result)) {
                  set.status = 400;
                  if (result.code === BE_ERRORS.BANK_ACCOUNT_NOT_FOUND.code) set.status = 404;
                  return apiError({ code: result.code, message: result.error || 'Failed to update bank account' });
                }
 
                const updatedAccount = result.data;
 
                await this.logAction.execute({
                  userId: actor!.id,
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

            // ==================== GET USER ACCOUNTS ====================
            .get(
              '/user/:userId',
              async (ctx: any) => {
                const { params: { userId }, set } = ctx as AuthenticatedElysiaContext;
                const result = await this.getUserBankAccountsAction.execute(userId);
                if (isFailureResult(result)) {
                  set.status = 404;
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
                    isDefault: a.isDefault
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
              async (ctx: any) => {
                const { actor, params: { debtId }, set } = ctx as AuthenticatedElysiaContext;
                const debt = await this.getDebtByIdAction.execute(debtId);
                if (!debt) {
                  set.status = 404;
                  return apiError(BE_ERRORS.DEBT_NOT_FOUND);
                }

                if (debt.debtorId !== actor!.id && debt.creditorId !== actor!.id) {
                  set.status = 403;
                  return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
                }

                if (!debt.creditorId) {
                  set.status = 400;
                  return apiError(BE_ERRORS.DEBT_NOT_FOUND, 'Debt has no creditor assigned');
                }
                
                const result = await this.getUserBankAccountsAction.execute(debt.creditorId);
                if (isFailureResult(result)) {
                  set.status = 400;
                  return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND);
                }

                const accounts = result.data;
                const defaultAccount = accounts.find((a: any) => a.isDefault) || accounts[0];
 
                if (!defaultAccount) {
                  set.status = 400;
                  return apiError(BE_ERRORS.BANK_ACCOUNT_NOT_FOUND, 'Creditor has no bank account linked');
                }
 
                const qrUrl = this.generateDebtPaymentQRAction.execute({
                  bankBin: defaultAccount.bankBin,
                  accountNumber: defaultAccount.accountNumber,
                  accountName: defaultAccount.accountName || '',
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
              async (ctx: any) => {
                const { actor, params: { id }, set, request, server } = ctx as AuthenticatedElysiaContext;
                const result = await this.deleteBankAccountAction.execute(id, actor!.id);
 
                if (isFailureResult(result)) {
                  set.status = 400;
                  if (result.code === BE_ERRORS.BANK_ACCOUNT_NOT_FOUND.code) set.status = 404;
                  return apiError({ code: result.code, message: result.error || 'Failed to delete bank account' });
                }
 
                await this.logAction.execute({
                  userId: actor!.id,
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
        )
    );
  }
}
