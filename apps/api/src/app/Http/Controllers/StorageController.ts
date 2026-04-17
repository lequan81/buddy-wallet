import { injectable, inject } from 'tsyringe';
import { Elysia, t } from 'elysia';
import { apiSuccess, apiError, BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import {
  uploadRateLimiter,
  fileDownloadRateLimiter,
  deleteRateLimiter
} from '@/lib/plugins/middleware';
import { permissionPlugin, containerPlugin, sessionAuthPlugin } from '@/lib/plugins';
import { PERMISSIONS } from '@/lib/security/permissions';
import { getClientIP } from '@lib/http/ip';
import { formatVND } from '@repo/utils';
import { requireAuth } from '@/lib/http';
import {
  UploadQRSchema,
  UploadPaymentProofSchema,
  RejectProofSchema
} from '@repo/schema';
import { DebtService } from '@/app/Services/DebtService';
import { FileService } from '@/app/Services/FileService';
import { UserService } from '@/app/Services/UserService';
import { PushService } from '@/app/Services/PushService';
import { ActivityService } from '@/app/Services/ActivityService';

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
    @inject(DebtService) private debtService: DebtService,
    @inject(FileService) private fileService: FileService,
    @inject(UserService) private userService: UserService,
    @inject(PushService) private pushService: PushService,
    @inject(ActivityService) private activityService: ActivityService
  ) {}

  register(app: Elysia): Elysia {
    return app.group('/upload', (group) =>
      group
        .use(containerPlugin)
        .use(sessionAuthPlugin)
        .use(permissionPlugin)

        // ==================== UPLOAD GROUP ====================
        .group('', (app) =>
          app
            .use(uploadRateLimiter)
            .post(
              '/qr',
              async ({ user, body, set }) => {
                const auth = requireAuth(user, set);
                if ('error' in auth) {
                  return auth.error;
                }

                const file = body.file as any;
                const result = await this.fileService.uploadFile(file, auth.user.id, 'qr_code');

                if ('code' in result) {
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
              async ({ user, params: { debtId }, body, set, request, server }) => {
                const auth = requireAuth(user, set);
                if ('error' in auth) {
                  return auth.error;
                }

                const debt = await this.debtService.getDebtById(debtId);
                if (!debt) {
                  set.status = 404;
                  return apiError(BE_ERRORS.DEBT_NOT_FOUND);
                }

                const isDebtor = debt.debtorId === auth.user.id;
                const isCreditor = debt.creditorId === auth.user.id;

                if (!isDebtor && !isCreditor) {
                  set.status = 403;
                  return apiError(BE_ERRORS.DEBT_PERMISSION_DENIED);
                }

                const file = body.file as any;
                const result = await this.fileService.uploadFile(file, auth.user.id, 'payment_proof', debtId);

                if ('code' in result) {
                  set.status = 400;
                  return apiError(mapFileServiceError(result.code), result.error);
                }

                const uploadedProof = result.data;

                // Send notification to creditor that proof was uploaded
                if (debt.creditorId && debt.creditorId !== auth.user.id) {
                  const canNotify = await this.userService.canReceivePush(debt.creditorId);
                  if (canNotify) {
                    this.pushService.sendToUser(debt.creditorId, {
                      title: 'Payment Proof Uploaded',
                      body: `Someone uploaded payment proof for ${formatVND(debt.amount)}`,
                      url: `/debts/${debtId}`,
                      tag: `proof-upload-${debtId}`
                    }).catch(() => { });
                  }
                }

                await this.activityService.log({
                  userId: auth.user.id,
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
        .group('', (app) =>
          app
            .use(fileDownloadRateLimiter)
            .get(
              '/file/:id',
              async ({ user, params: { id }, set }) => {
                const auth = requireAuth(user, set);
                if ('error' in auth) {
                  return auth.error;
                }
                const isAdmin = user?.role === 'admin';
                const result = await this.fileService.getFile(id, auth.user.id, isAdmin);

                if ('code' in result) {
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
              async ({ user, set }) => {
                const auth = requireAuth(user, set);
                if ('error' in auth) {
                  return auth.error;
                }

                const result = await this.fileService.getUserQRCodes(auth.user.id);
                if (isFailureResult(result)) {
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
              async ({ user, params: { debtId }, set }) => {
                const auth = requireAuth(user, set);
                if ('error' in auth) {
                  return auth.error;
                }

                const debt = await this.debtService.getDebtById(debtId);
                if (!debt) {
                  set.status = 404;
                  return apiError(BE_ERRORS.DEBT_NOT_FOUND);
                }

                const isCreditor = debt.creditorId === auth.user.id;
                if (!isCreditor) {
                  set.status = 403;
                  return apiError(BE_ERRORS.FILE_PERMISSION_DENIED, 'Only creditor can view pending proofs');
                }

                const result = await this.fileService.getPendingProofs(debtId);
                if (isFailureResult(result)) {
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
        .group('', (app) =>
          app
            .use(deleteRateLimiter)
            .post(
              '/proof/:id/approve',
              async ({ user, params: { id }, set, request, server }) => {
                const auth = requireAuth(user, set);
                if ('error' in auth) {
                  return auth.error;
                }

                const result = await this.fileService.approveProof(id, auth.user.id);

                if ('code' in result) {
                  set.status = 400;
                  return apiError(mapFileServiceError(result.code), result.error);
                }

                const approvalData = result.data;

                if (approvalData.uploaderId && approvalData.uploaderId !== auth.user.id) {
                  const canNotify = await this.userService.canReceivePush(approvalData.uploaderId);
                  if (canNotify) {
                    this.pushService.sendToUser(approvalData.uploaderId, {
                      title: 'Proof Approved',
                      body: 'Your payment proof has been approved by the creditor',
                      url: `/debts/${approvalData.debtId}`,
                      tag: `proof-approved-${approvalData.debtId}`
                    }).catch(() => { });
                  }
                }

                await this.activityService.log({
                  userId: auth.user.id,
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
              async ({ user, params: { id }, body, set, request, server }) => {
                const auth = requireAuth(user, set);
                if ('error' in auth) {
                  return auth.error;
                }

                const result = await this.fileService.rejectProof(id, auth.user.id, body.reason);

                if ('code' in result) {
                  set.status = 400;
                  return apiError(mapFileServiceError(result.code), result.error);
                }

                const rejectionData = result.data;

                if (rejectionData.uploaderId && rejectionData.uploaderId !== auth.user.id) {
                  const canNotify = await this.userService.canReceivePush(rejectionData.uploaderId);
                  if (canNotify) {
                    const reasonText = body.reason ? `: ${body.reason}` : '';
                    this.pushService.sendToUser(rejectionData.uploaderId, {
                      title: 'Proof Rejected',
                      body: `Your payment proof was rejected${reasonText}`,
                      url: `/debts/${rejectionData.debtId}`,
                      tag: `proof-rejected-${rejectionData.debtId}`
                    }).catch(() => { });
                  }
                }

                await this.activityService.log({
                  userId: auth.user.id,
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
              async ({ user, params: { id }, set, request, server }) => {
                const auth = requireAuth(user, set);
                if ('error' in auth) {
                  return auth.error;
                }

                const result = await this.fileService.deleteFile(id, auth.user.id);

                if ('code' in result) {
                  set.status = result.code === 'FILE_ACCESS_DENIED' ? 403 : 400;
                  return apiError(
                    result.code === 'FILE_ACCESS_DENIED'
                      ? BE_ERRORS.FILE_PERMISSION_DENIED
                      : BE_ERRORS.FILE_NOT_FOUND,
                    result.error
                  );
                }

                await this.activityService.log({
                  userId: auth.user.id,
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

function isFailureResult(result: any): result is { code: string; error: string } {
  return result && typeof result === 'object' && 'code' in result;
}
