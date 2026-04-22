import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import { actor, permissionPlugin } from '@/app/Providers/Plugins';
import {
  uploadRateLimiter,
  fileDownloadRateLimiter,
  deleteRateLimiter
} from '@/app/Http/Middlewares';
import { PERMISSIONS } from '@/lib/security/permissions';
import { getClientIP } from '@/lib/http/ip';
import { formatVND } from '@repo/utils';
import { apiSuccess, apiError, isFailureResult } from '@/lib/http';
import type { AuthenticatedElysiaContext } from '@/types/elysia';
import {
  UploadQRSchema,
  UploadPaymentProofSchema,
  RejectProofSchema
} from '@repo/schema';
import { GetDebtByIdAction } from '@/app/Actions/Debt/GetDebtByIdAction';
import { UploadFileAction } from '@/app/Actions/Storage/UploadFileAction';
import { GetFileAction } from '@/app/Actions/Storage/GetFileAction';
import { GetUserQRCodesAction } from '@/app/Actions/Storage/GetUserQRCodesAction';
import { GetPendingProofsAction } from '@/app/Actions/Storage/GetPendingProofsAction';
import { ApproveProofAction } from '@/app/Actions/Storage/ApproveProofAction';
import { RejectProofAction } from '@/app/Actions/Storage/RejectProofAction';
import { DeleteFileAction } from '@/app/Actions/Storage/DeleteFileAction';
import { CanReceivePushAction } from '@/app/Actions/User/CanReceivePushAction';
import { SendToUserAction } from '@/app/Actions/System/SendToUserAction';
import { LogAction } from '@/app/Actions/System/LogAction';

const mapFileServiceError = (code?: string) => {
  if (!code) return GEN_ERRORS.UNKNOWN;
  if (code === 'FILE_TOO_LARGE') return BE_ERRORS.FILE_TOO_LARGE;
  if (code === 'FILE_INVALID_TYPE') return BE_ERRORS.FILE_INVALID_TYPE;
  if (code === 'FILE_INVALID_FORMAT') return BE_ERRORS.FILE_CONTENT_MISMATCH;
  if (code === 'FILE_NOT_FOUND') return BE_ERRORS.FILE_NOT_FOUND;
  if (code === 'FILE_ACCESS_DENIED') return BE_ERRORS.FILE_PERMISSION_DENIED;
  return GEN_ERRORS.INVALID_INPUT;
};

@injectable()
export class StorageController {
  constructor(
    @inject(GetDebtByIdAction) private getDebtByIdAction: GetDebtByIdAction,
    @inject(UploadFileAction) private uploadFileAction: UploadFileAction,
    @inject(GetFileAction) private getFileAction: GetFileAction,
    @inject(GetUserQRCodesAction) private getUserQRCodesAction: GetUserQRCodesAction,
    @inject(GetPendingProofsAction) private getPendingProofsAction: GetPendingProofsAction,
    @inject(ApproveProofAction) private approveProofAction: ApproveProofAction,
    @inject(RejectProofAction) private rejectProofAction: RejectProofAction,
    @inject(DeleteFileAction) private deleteFileAction: DeleteFileAction,
    @inject(CanReceivePushAction) private canReceivePushAction: CanReceivePushAction,
    @inject(SendToUserAction) private sendToUserAction: SendToUserAction,
    @inject(LogAction) private logAction: LogAction
  ) { }

  register(app: Elysia): any {
    return app.group('/upload', (group) =>
      group
        .use(actor)
        .use(permissionPlugin)
        // @ts-expect-error macro
        .requireActor(true)

        // ==================== UPLOAD GROUP ====================
        .group('', (uploadGroup: any) =>
          uploadGroup
            .use(uploadRateLimiter)
            .post(
              '/qr',
              async (ctx: any) => {
                const { actor, body, set } = ctx as AuthenticatedElysiaContext<any>;
                const file = body.file as any;
                const result = await this.uploadFileAction.execute(file, actor!.id, 'qr_code');

                if (isFailureResult(result)) {
                  set.status = 400;
                  return apiError(mapFileServiceError(result.code), result.error);
                }

                const uploadedFile = result.data;

                return apiSuccess({
                  file: {
                    id: uploadedFile.id,
                    filename: uploadedFile.filename,
                    size: uploadedFile.sizeBytes,
                    url: `/upload/file/${uploadedFile.id}`
                  }
                });
              },
              {
                body: UploadQRSchema,
                checkPermission: PERMISSIONS.DEBT_CREATE
              }
            )
            .post(
              '/payment-proof/:debtId',
              async (ctx: any) => {
                const { actor, params: { debtId }, body, set, request, server } = ctx as AuthenticatedElysiaContext<any>;
                const debt = await this.getDebtByIdAction.execute(debtId);
                if (!debt) {
                  set.status = 404;
                  return apiError(BE_ERRORS.DEBT_NOT_FOUND);
                }

                const isDebtor = debt.debtorId === actor!.id;
                const isCreditor = debt.creditorId === actor!.id;

                if (!isDebtor && !isCreditor) {
                  set.status = 403;
                  return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
                }

                const file = body.file as any;
                const result = await this.uploadFileAction.execute(file, actor!.id, 'payment_proof', debtId);

                if (isFailureResult(result)) {
                  set.status = 400;
                  return apiError(mapFileServiceError(result.code), result.error);
                }

                const uploadedProof = result.data;

                // Send notification to creditor that proof was uploaded
                if (debt.creditorId && debt.creditorId !== actor!.id) {
                  const canNotify = await this.canReceivePushAction.execute(debt.creditorId);
                  if (canNotify) {
                    this.sendToUserAction.execute(debt.creditorId, {
                      title: 'Payment Proof Uploaded',
                      body: `Someone uploaded payment proof for ${formatVND(debt.amount)}`,
                      url: `/debts/${debtId}`,
                      tag: `proof-upload-${debtId}`
                    }).catch(() => { });
                  }
                }

                await this.logAction.execute({
                  userId: actor!.id,
                  action: 'upload',
                  resource: 'file',
                  resourceId: uploadedProof.id,
                  metadata: { debtId, fileType: 'payment_proof', filename: uploadedProof.filename },
                  ipAddress: getClientIP(request, server) || undefined,
                  userAgent: request.headers.get('user-agent') || undefined
                });

                return apiSuccess({
                  file: {
                    id: uploadedProof.id,
                    filename: uploadedProof.filename,
                    size: uploadedProof.sizeBytes,
                    status: uploadedProof.status,
                    url: `/upload/file/${uploadedProof.id}`
                  }
                });
              },
              {
                params: t.Object({ debtId: t.String() }),
                body: UploadPaymentProofSchema,
                checkPermission: PERMISSIONS.DEBT_VIEW_OWN
              }
            )
        )

        // ==================== DOWNLOAD GROUP ====================
        .group('', (downloadGroup: any) =>
          downloadGroup
            .use(fileDownloadRateLimiter)
            .get(
              '/file/:id',
              async (ctx: any) => {
                const { actor, params: { id }, set } = ctx as AuthenticatedElysiaContext;
                const isAdmin = (actor as any).role === 'admin';
                const result = await this.getFileAction.execute(id, actor!.id, isAdmin);

                if (isFailureResult(result)) {
                  set.status = result.code === 'FILE_ACCESS_DENIED' ? 403 : 404;
                  return apiError(
                    result.code === 'FILE_ACCESS_DENIED'
                      ? BE_ERRORS.FILE_PERMISSION_DENIED
                      : BE_ERRORS.FILE_NOT_FOUND
                  );
                }

                const fileData = result.data;
                set.headers['Content-Type'] = fileData.mimeType;
                set.headers['Cache-Control'] = 'private, max-age=3600';
                return fileData.data;
              },
              {
                params: t.Object({ id: t.String() }),
                checkPermission: PERMISSIONS.DEBT_VIEW_OWN
              }
            )

            .get(
              '/my-qr',
              async (ctx: any) => {
                const { actor, set } = ctx as AuthenticatedElysiaContext;
                const result = await this.getUserQRCodesAction.execute(actor!.id);
                if (isFailureResult(result)) {
                  set.status = 500;
                  return apiError(GEN_ERRORS.UNKNOWN, result.error);
                }

                const qrCodes = result.data;
                return apiSuccess({
                  files: qrCodes.map((f: any) => ({
                    id: f.id,
                    filename: f.filename,
                    size: f.sizeBytes,
                    url: `/upload/file/${f.id}`,
                    createdAt: f.createdAt
                  }))
                });
              },
              { checkPermission: PERMISSIONS.DEBT_VIEW_OWN }
            )
            .get(
              '/pending-proofs/:debtId',
              async (ctx: any) => {
                const { actor, params: { debtId }, set } = ctx as AuthenticatedElysiaContext;
                const debt = await this.getDebtByIdAction.execute(debtId);
                if (!debt) {
                  set.status = 404;
                  return apiError(BE_ERRORS.DEBT_NOT_FOUND);
                }

                const isCreditor = debt.creditorId === actor!.id;
                if (!isCreditor) {
                  set.status = 403;
                  return apiError(BE_ERRORS.FILE_PERMISSION_DENIED, 'Only creditor can view pending proofs');
                }

                const result = await this.getPendingProofsAction.execute(debtId);
                if (isFailureResult(result)) {
                  set.status = 500;
                  return apiError(GEN_ERRORS.UNKNOWN, result.error);
                }

                const proofs = result.data;
                return apiSuccess({
                  files: proofs.map((f: any) => ({
                    id: f.id,
                    filename: f.filename,
                    size: f.sizeBytes,
                    status: f.status,
                    url: `/upload/file/${f.id}`,
                    uploadedById: f.uploadedById,
                    createdAt: f.createdAt
                  }))
                });
              },
              {
                params: t.Object({ debtId: t.String() }),
                checkPermission: PERMISSIONS.DEBT_VIEW_OWN
              }
            )
        )

        // ==================== ACTIONS/MODERATION GROUP ====================
        .group('', (actionGroup: any) =>
          actionGroup
            .use(deleteRateLimiter)
            .post(
              '/proof/:id/approve',
              async (ctx: any) => {
                const { actor, params: { id }, set, request, server } = ctx as AuthenticatedElysiaContext;
                const result = await this.approveProofAction.execute(id, actor!.id);

                if (isFailureResult(result)) {
                  set.status = 400;
                  return apiError(mapFileServiceError(result.code), result.error);
                }

                const approvalData = result.data;

                if (approvalData.uploaderId && approvalData.uploaderId !== actor!.id) {
                  const canNotify = await this.canReceivePushAction.execute(approvalData.uploaderId);
                  if (canNotify) {
                    this.sendToUserAction.execute(approvalData.uploaderId, {
                      title: 'Proof Approved',
                      body: 'Your payment proof has been approved by the creditor',
                      url: `/debts/${approvalData.debtId}`,
                      tag: `proof-approved-${approvalData.debtId}`
                    }).catch(() => { });
                  }
                }

                await this.logAction.execute({
                  userId: actor!.id,
                  action: 'approve',
                  resource: 'file',
                  resourceId: id,
                  metadata: { debtId: approvalData.debtId, allProofsApproved: approvalData.allProofsApproved },
                  ipAddress: getClientIP(request, server) || undefined,
                  userAgent: request.headers.get('user-agent') || undefined
                });

                return apiSuccess({
                  message: 'Proof approved',
                  allProofsApproved: approvalData.allProofsApproved,
                  debtId: approvalData.debtId
                });
              },
              {
                params: t.Object({ id: t.String() }),
                checkPermission: PERMISSIONS.DEBT_VIEW_OWN
              }
            )
            .post(
              '/proof/:id/reject',
              async (ctx: any) => {
                const { actor, params: { id }, body, set, request, server } = ctx as AuthenticatedElysiaContext<any>;
                const result = await this.rejectProofAction.execute(id, actor!.id, body.reason);

                if (isFailureResult(result)) {
                  set.status = 400;
                  return apiError(mapFileServiceError(result.code), result.error);
                }

                const rejectionData = result.data;

                if (rejectionData.uploaderId && rejectionData.uploaderId !== actor!.id) {
                  const canNotify = await this.canReceivePushAction.execute(rejectionData.uploaderId);
                  if (canNotify) {
                    const reasonText = body.reason ? `: ${body.reason}` : '';
                    this.sendToUserAction.execute(rejectionData.uploaderId, {
                      title: 'Proof Rejected',
                      body: `Your payment proof was rejected${reasonText}`,
                      url: `/debts/${rejectionData.debtId}`,
                      tag: `proof-rejected-${rejectionData.debtId}`
                    }).catch(() => { });
                  }
                }

                await this.logAction.execute({
                  userId: actor!.id,
                  action: 'reject',
                  resource: 'file',
                  resourceId: id,
                  metadata: { debtId: rejectionData.debtId, reason: body.reason },
                  ipAddress: getClientIP(request, server) || undefined,
                  userAgent: request.headers.get('user-agent') || undefined
                });

                return apiSuccess({ message: 'Proof rejected' });
              },
              {
                params: t.Object({ id: t.String() }),
                body: RejectProofSchema,
                checkPermission: PERMISSIONS.DEBT_VIEW_OWN
              }
            )
            .delete(
              '/file/:id',
              async (ctx: any) => {
                const { actor, params: { id }, set, request, server } = ctx as AuthenticatedElysiaContext;
                const result = await this.deleteFileAction.execute(id, actor!.id);

                if (isFailureResult(result)) {
                  set.status = result.code === 'FILE_ACCESS_DENIED' ? 403 : 400;
                  return apiError(
                    result.code === 'FILE_ACCESS_DENIED'
                      ? BE_ERRORS.FILE_PERMISSION_DENIED
                      : BE_ERRORS.FILE_NOT_FOUND,
                    result.error
                  );
                }

                await this.logAction.execute({
                  userId: actor!.id,
                  action: 'delete',
                  resource: 'file',
                  resourceId: id,
                  ipAddress: getClientIP(request, server) || undefined,
                  userAgent: request.headers.get('user-agent') || undefined
                });

                return apiSuccess({ message: 'File deleted' });
              },
              {
                params: t.Object({ id: t.String() }),
                checkPermission: PERMISSIONS.DEBT_VIEW_OWN
              }
            )
        )
    );
  }
}
