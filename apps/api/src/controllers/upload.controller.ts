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
import { FileService, DebtService, PushService, UserService } from '../services';

import { formatVND } from '@repo/utils';

// Helper to check if user can receive push notifications
async function canReceivePush(userId: string): Promise<boolean> {
  const result = await UserService.getUserById(userId);
  if (!result.user) return false;
  // Must have verified email AND push enabled
  return result.user.emailVerified === true && result.user.pushNotificationsEnabled === true;
}

export const UploadController = new Elysia({ prefix: '/upload' })
  .use(permissionPlugin)

  // ==================== UPLOAD GROUP ====================
  // Strict upload limits (10/min)
  .group('', (app) =>
    app
      .use(uploadRateLimiter)
      .post(
        '/qr',
        async ({ user, body, set }) => {
          const file = body.file;

          const result = await FileService.uploadFile(file, user!.id, 'qr_code');

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
        async ({ user, params: { debtId }, body, set }) => {
          // Verify debt exists and user is related to it
          const debt = await DebtService.getDebtById(debtId);
          if (!debt) {
            set.status = 404;
            return { success: false, error: 'Debt not found' };
          }

          // SECURITY FIX 1: Use user ID for authorization (not phoneNumber)
          // phoneNumber could be spoofed if Redis cache is compromised
          const isDebtor = debt.debtorId === user!.id;
          const isCreditor = debt.creditorId === user!.id;

          if (!isDebtor && !isCreditor) {
            set.status = 403;
            return { success: false, error: 'Not authorized for this debt' };
          }

          const file = body.file;
          const result = await FileService.uploadFile(file, user!.id, 'payment_proof', debtId);

          if (!result.success) {
            set.status = 400;
            return result;
          }

          // Send notification to creditor that proof was uploaded
          if (debt.creditorId && debt.creditorId !== user!.id) {
            const canNotify = await canReceivePush(debt.creditorId);
            if (canNotify) {
              PushService.sendToUser(debt.creditorId, {
                title: 'Payment Proof Uploaded',
                body: `Someone uploaded payment proof for ${formatVND(debt.amount)}`,
                url: `/debts/${debtId}`,
                tag: `proof-upload-${debtId}`
              }).catch(() => {}); // Don't fail request if notification fails
            }
          }

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
        async ({ user, params: { id }, set }) => {
          const result = await FileService.getFile(id);

          if (!result.success) {
            set.status = 404;
            return { success: false, error: result.error };
          }

          // Access control: owner OR related debt party
          const meta = result.metadata!;
          const isOwner = meta.uploadedById === user?.id;

          let hasAccess = isOwner;
          if (!hasAccess && meta.relatedDebtId) {
            const debt = await DebtService.getDebtById(meta.relatedDebtId);
            if (debt) {
              // SECURITY FIX 1: Use user ID for authorization (not phoneNumber)
              hasAccess = debt.debtorId === user?.id || debt.creditorId === user?.id;
            }
          }

          // QR codes are viewable by owner only
          if (meta.fileType === 'qr_code' && !isOwner) {
            set.status = 403;
            return { success: false, error: 'Not authorized' };
          }

          // Payment proofs need relationship check
          if (meta.fileType === 'payment_proof' && !hasAccess) {
            set.status = 403;
            return { success: false, error: 'Not authorized' };
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
        async ({ user }) => {
          const qrCodes = await FileService.getUserQRCodes(user!.id);
          return {
            success: true,
            files: qrCodes.map((f) => ({
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
        async ({ user, params: { debtId }, set }) => {
          // Verify debt exists and user is creditor
          const debt = await DebtService.getDebtById(debtId);
          if (!debt) {
            set.status = 404;
            return { success: false, error: 'Debt not found' };
          }

          // SECURITY FIX 1: Use user ID for authorization (not phoneNumber)
          const isCreditor = debt.creditorId === user!.id;
          if (!isCreditor) {
            set.status = 403;
            return { success: false, error: 'Only creditor can view pending proofs' };
          }

          const proofs = await FileService.getPendingProofs(debtId);
          return {
            success: true,
            files: proofs.map((f) => ({
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
        async ({ user, params: { id }, set }) => {
          const result = await FileService.approveProof(id, user!.id);

          if (!result.success) {
            set.status = 400;
            return result;
          }

          // Send notification to proof uploader that their proof was approved
          if (result.uploaderId && result.uploaderId !== user!.id) {
            const canNotify = await canReceivePush(result.uploaderId);
            if (canNotify) {
              PushService.sendToUser(result.uploaderId, {
                title: 'Proof Approved',
                body: 'Your payment proof has been approved by the creditor',
                url: `/debts/${result.debtId}`,
                tag: `proof-approved-${result.debtId}`
              }).catch(() => {});
            }
          }

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
        async ({ user, params: { id }, body, set }) => {
          const result = await FileService.rejectProof(id, user!.id, body.reason);

          if (!result.success) {
            set.status = 400;
            return result;
          }

          // Send notification to proof uploader that their proof was rejected
          if (result.uploaderId && result.uploaderId !== user!.id) {
            const canNotify = await canReceivePush(result.uploaderId);
            if (canNotify) {
              const reasonText = body.reason ? `: ${body.reason}` : '';
              PushService.sendToUser(result.uploaderId, {
                title: 'Proof Rejected',
                body: `Your payment proof was rejected${reasonText}`,
                url: `/debts/${result.debtId}`,
                tag: `proof-rejected-${result.debtId}`
              }).catch(() => {});
            }
          }

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
        async ({ user, params: { id }, set }) => {
          const result = await FileService.deleteFile(id, user!.id);

          if (!result.success) {
            set.status = result.error === 'Not authorized' ? 403 : 400;
            return result;
          }

          return { success: true, message: 'File deleted' };
        },
        {
          params: t.Object({ id: t.String() }),
          checkPermission: PERMISSIONS.DEBT_VIEW_OWN
        }
      )
  );
