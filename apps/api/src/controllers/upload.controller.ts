/**
 * Upload Controller
 *
 * Handles file uploads for QR codes and payment proofs.
 */
import { Elysia, t } from 'elysia';
import { permissionPlugin } from '../plugins/guards';
import {
  uploadRateLimiter,
  deleteRateLimiter,
  fileDownloadRateLimiter
} from '../plugins/middleware';
import { PERMISSIONS } from '@repo/permissions';
import { BE_ERRORS, errorResponse } from '@repo/errors';
import { getClientIP } from '../utils';
import { servicesPlugin, services } from '../plugins/services.plugin';

import { formatVND } from '@repo/utils';

// Helper to check if user can receive push notifications
async function canReceivePush(userId: string, userService: typeof services.userService): Promise<boolean> {
  const result = await userService.getUserById(userId);
  if (!result.user) return false;
  // Must have verified email AND push enabled
  return result.user.emailVerified === true && result.user.pushNotificationsEnabled === true;
}

export const UploadController = new Elysia({ prefix: '/upload' })
  .use(servicesPlugin)
  .use(permissionPlugin)

  // ==================== UPLOAD GROUP ====================
  // Strict upload limits (10/min)
  .group('', (app) =>
    app
      .use(uploadRateLimiter)
      .post(
        '/qr',
        async ({ user, body, set, fileService }) => {
          const file = body.file;

          const result = await fileService.uploadFile(file, user!.id, 'qr_code');

          if (!result.success) {
            set.status = 400;
            return result;
          }

          return {
            success: true,
            file: {
              id: result.file!.id,
              filename: result.file!.filename,
              size: result.file!.sizeBytes,
              url: `/upload/file/${result.file!.id}`
            }
          };
        },
        {
          body: t.Object({
            file: t.File({
              type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
              maxSize: '4m'
            })
          }),
          checkPermission: PERMISSIONS.DEBT_CREATE // User can upload QR
        }
      )
      .post(
        '/payment-proof/:debtId',
        async ({ user, params: { debtId }, body, set, request, server, debtService, fileService, userService, pushService, activityService }) => {
          // Verify debt exists and user is related to it
          const debt = await debtService.getDebtById(debtId);
          if (!debt) {
            set.status = 404;
            return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
          }

          // SECURITY FIX 1: Use user ID for authorization (not phoneNumber)
          // phoneNumber could be spoofed if Redis cache is compromised
          const isDebtor = debt.debtorId === user!.id;
          const isCreditor = debt.creditorId === user!.id;

          if (!isDebtor && !isCreditor) {
            set.status = 403;
            return errorResponse(BE_ERRORS.DEBT_PERMISSION_DENIED);
          }

          const file = body.file;
          const result = await fileService.uploadFile(file, user!.id, 'payment_proof', debtId);

          if (!result.success) {
            set.status = 400;
            return result;
          }

          // Send notification to creditor that proof was uploaded
          if (debt.creditorId && debt.creditorId !== user!.id) {
            const canNotify = await canReceivePush(debt.creditorId, userService);
            if (canNotify) {
              pushService.sendToUser(debt.creditorId, {
                title: 'Payment Proof Uploaded',
                body: `Someone uploaded payment proof for ${formatVND(debt.amount)}`,
                url: `/debts/${debtId}`,
                tag: `proof-upload-${debtId}`
              }).catch(() => { }); // Don't fail request if notification fails
            }
          }

          await activityService.log({
            userId: user!.id,
            action: 'upload',
            resource: 'file',
            resourceId: result.file!.id,
            metadata: { debtId, fileType: 'payment_proof', filename: result.file!.filename },
            ipAddress: getClientIP(request, server) || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });

          return {
            success: true,
            file: {
              id: result.file!.id,
              filename: result.file!.filename,
              size: result.file!.sizeBytes,
              status: result.file!.status,
              url: `/upload/file/${result.file!.id}`
            }
          };
        },
        {
          params: t.Object({ debtId: t.String() }),
          body: t.Object({
            file: t.File({
              type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
              maxSize: '4m'
            })
          }),
          checkPermission: PERMISSIONS.DEBT_VIEW_OWN
        }
      )
  )

  // ==================== DOWNLOAD GROUP ====================
  // Lenient limits to allow the UI to fetch multiple images in parallel (100/min)
  .group('', (app) =>
    app
      .use(fileDownloadRateLimiter)
      .get(
        '/file/:id',
        async ({ user, params: { id }, set, fileService }) => {
          const isAdmin = user?.role === 'admin';
          const result = await fileService.getFile(id, user!.id, isAdmin);

          if (!result.success) {
            set.status = result.error === 'Access denied' ? 403 : 404;
            return errorResponse(
              result.error === 'Access denied' ? BE_ERRORS.FILE_PERMISSION_DENIED : BE_ERRORS.FILE_NOT_FOUND
            );
          }

          set.headers['Content-Type'] = result.mimeType!;
          set.headers['Cache-Control'] = 'private, max-age=3600';
          return result.data;
        },
        {
          params: t.Object({ id: t.String() }),
          checkPermission: PERMISSIONS.DEBT_VIEW_OWN
        }
      )

      .get(
        '/my-qr',
        async ({ user, fileService }) => {
          const qrCodes = await fileService.getUserQRCodes(user!.id);
          return {
            success: true,
            files: qrCodes.map((f: typeof qrCodes[0]) => ({
              id: f.id,
              filename: f.filename,
              size: f.sizeBytes,
              url: `/upload/file/${f.id}`,
              createdAt: f.createdAt
            }))
          };
        },
        { checkPermission: PERMISSIONS.DEBT_VIEW_OWN }
      )
      .get(
        '/pending-proofs/:debtId',
        async ({ user, params: { debtId }, set, debtService, fileService }) => {
          // Verify debt exists and user is creditor
          const debt = await debtService.getDebtById(debtId);
          if (!debt) {
            set.status = 404;
            return errorResponse(BE_ERRORS.DEBT_NOT_FOUND);
          }

          // SECURITY FIX 1: Use user ID for authorization (not phoneNumber)
          const isCreditor = debt.creditorId === user!.id;
          if (!isCreditor) {
            set.status = 403;
            return errorResponse(BE_ERRORS.FILE_PERMISSION_DENIED, 'Only creditor can view pending proofs');
          }

          const proofs = await fileService.getPendingProofs(debtId);
          return {
            success: true,
            files: proofs.map((f: typeof proofs[0]) => ({
              id: f.id,
              filename: f.filename,
              size: f.sizeBytes,
              status: f.status,
              url: `/upload/file/${f.id}`,
              uploadedById: f.uploadedById,
              createdAt: f.createdAt
            }))
          };
        },
        {
          params: t.Object({ debtId: t.String() }),
          checkPermission: PERMISSIONS.DEBT_VIEW_OWN
        }
      )
  )

  // ==================== ACTIONS/MODERATION GROUP ====================
  // Moderate limits for app actions/file deletions (20/min)
  .group('', (app) =>
    app
      .use(deleteRateLimiter)
      .post(
        '/proof/:id/approve',
        async ({ user, params: { id }, set, request, server, fileService, userService, pushService, activityService }) => {
          const result = await fileService.approveProof(id, user!.id);

          if (!result.success) {
            set.status = 400;
            return result;
          }

          // Send notification to proof uploader that their proof was approved
          if (result.uploaderId && result.uploaderId !== user!.id) {
            const canNotify = await canReceivePush(result.uploaderId, userService);
            if (canNotify) {
              pushService.sendToUser(result.uploaderId, {
                title: 'Proof Approved',
                body: 'Your payment proof has been approved by the creditor',
                url: `/debts/${result.debtId}`,
                tag: `proof-approved-${result.debtId}`
              }).catch(() => { });
            }
          }

          await activityService.log({
            userId: user!.id,
            action: 'approve',
            resource: 'file',
            resourceId: id,
            metadata: { debtId: result.debtId, allProofsApproved: result.allProofsApproved },
            ipAddress: getClientIP(request, server) || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });

          return {
            success: true,
            message: 'Proof approved',
            allProofsApproved: result.allProofsApproved,
            debtId: result.debtId
          };
        },
        {
          params: t.Object({ id: t.String() }),
          checkPermission: PERMISSIONS.DEBT_VIEW_OWN
        }
      )
      .post(
        '/proof/:id/reject',
        async ({ user, params: { id }, body, set, request, server, fileService, userService, pushService, activityService }) => {
          const result = await fileService.rejectProof(id, user!.id, body.reason);

          if (!result.success) {
            set.status = 400;
            return result;
          }

          // Send notification to proof uploader that their proof was rejected
          if (result.uploaderId && result.uploaderId !== user!.id) {
            const canNotify = await canReceivePush(result.uploaderId, userService);
            if (canNotify) {
              const reasonText = body.reason ? `: ${body.reason}` : '';
              pushService.sendToUser(result.uploaderId, {
                title: 'Proof Rejected',
                body: `Your payment proof was rejected${reasonText}`,
                url: `/debts/${result.debtId}`,
                tag: `proof-rejected-${result.debtId}`
              }).catch(() => { });
            }
          }

          await activityService.log({
            userId: user!.id,
            action: 'reject',
            resource: 'file',
            resourceId: id,
            metadata: { debtId: result.debtId, reason: body.reason },
            ipAddress: getClientIP(request, server) || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });

          return { success: true, message: 'Proof rejected' };
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            reason: t.Optional(t.String({ maxLength: 500 }))
          }),
          checkPermission: PERMISSIONS.DEBT_VIEW_OWN
        }
      )
      .delete(
        '/file/:id',
        async ({ user, params: { id }, set, request, server, fileService, activityService }) => {
          const result = await fileService.deleteFile(id, user!.id);

          if (!result.success) {
            set.status = result.error === 'Not authorized' ? 403 : 400;
            return errorResponse(
              result.error === 'Not authorized' ? BE_ERRORS.FILE_PERMISSION_DENIED : BE_ERRORS.FILE_NOT_FOUND,
              result.error
            );
          }

          await activityService.log({
            userId: user!.id,
            action: 'delete',
            resource: 'file',
            resourceId: id,
            ipAddress: getClientIP(request, server) || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });

          return { success: true, message: 'File deleted' };
        },
        {
          params: t.Object({ id: t.String() }),
          checkPermission: PERMISSIONS.DEBT_VIEW_OWN
        }
      )
  );
