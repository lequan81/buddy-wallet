/**
 * Upload Controller
 *
 * Handles file uploads for QR codes and payment proofs.
 */
import { Elysia, t } from 'elysia';
import { permissionPlugin } from '@plugins/guards';
import { standardRateLimiter, uploadRateLimiter, deleteRateLimiter } from '@plugins/middleware';
import { PERMISSIONS } from '@repo/permissions';
import { fileService, debtService } from '@/services';

export const uploadController = new Elysia({ prefix: '/upload' })
  .use(permissionPlugin)
  // Use uploadRateLimiter for all routes in this controller (most are uploads)
  // GET routes will also share this limit, which is fine (10/min is strict but acceptable)
  // If we needed split limits, we'd apply them per-route or guard.
  .use(uploadRateLimiter)

  // ==================== UPLOAD QR CODE ====================
  .post(
    '/qr',
    async ({ user, body, set }) => {
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

  // ==================== UPLOAD PAYMENT PROOF ====================
  .post(
    '/payment-proof/:debtId',
    async ({ user, params: { debtId }, body, set }) => {
      // Verify debt exists and user is related to it
      const debt = await debtService.getDebtById(debtId);
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
      const result = await fileService.uploadFile(file, user!.id, 'payment_proof', debtId);

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

  // ==================== GET FILE ====================
  .get(
    '/file/:id',
    async ({ user, params: { id }, set }) => {
      const result = await fileService.getFile(id);

      if (!result.success) {
        set.status = 404;
        return { success: false, error: result.error };
      }

      // Access control: owner OR related debt party
      const meta = result.metadata!;
      const isOwner = meta.uploadedById === user?.id;

      let hasAccess = isOwner;
      if (!hasAccess && meta.relatedDebtId) {
        const debt = await debtService.getDebtById(meta.relatedDebtId);
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

  // ==================== LIST MY QR CODES ====================
  .get(
    '/my-qr',
    async ({ user }) => {
      const qrCodes = await fileService.getUserQRCodes(user!.id);
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

  // ==================== LIST PENDING PROOFS FOR DEBT ====================
  .get(
    '/pending-proofs/:debtId',
    async ({ user, params: { debtId }, set }) => {
      // Verify debt exists and user is creditor
      const debt = await debtService.getDebtById(debtId);
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

      const proofs = await fileService.getPendingProofs(debtId);
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

  // ==================== APPROVE PROOF ====================
  .post(
    '/proof/:id/approve',
    async ({ user, params: { id }, set }) => {
      const result = await fileService.approveProof(id, user!.id);

      if (!result.success) {
        set.status = 400;
        return result;
      }

      return { success: true, message: 'Proof approved' };
    },
    {
      params: t.Object({ id: t.String() }),
      checkPermission: PERMISSIONS.DEBT_VIEW_OWN
    }
  )

  // ==================== REJECT PROOF ====================
  .post(
    '/proof/:id/reject',
    async ({ user, params: { id }, body, set }) => {
      const result = await fileService.rejectProof(id, user!.id, body.reason);

      if (!result.success) {
        set.status = 400;
        return result;
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

  // ==================== DELETE FILE ====================
  .use(deleteRateLimiter) // Rate limit: 20 deletes per minute
  .delete(
    '/file/:id',
    async ({ user, params: { id }, set }) => {
      const result = await fileService.deleteFile(id, user!.id);

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
  );
