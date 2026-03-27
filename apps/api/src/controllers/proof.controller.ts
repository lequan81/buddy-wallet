import { Elysia, t } from 'elysia';
import { db, debts, eq } from '@repo/db';
import { FileService } from '@services/storage/file.service';
import { ActivityService } from '@services/activity.service';
import { UPLOAD_TMP_DIR, PROOF_TMP_DIR } from '@repo/config';
import { DiskStorageService } from '@services/storage.service';
import { ImageService } from '@services/image.service';
import { BE_ERRORS, GEN_ERRORS, errorResponse, successResponse } from '@repo/errors';
import type { User } from '@/types';

const uploadStorage = new DiskStorageService(UPLOAD_TMP_DIR);
const proofStorage = new DiskStorageService(PROOF_TMP_DIR);
const imageService = new ImageService();
const fileService = new FileService(db, uploadStorage, proofStorage, imageService);
const activityService = new ActivityService(db);

export const ProofController = new Elysia({ prefix: '/proofs' })
  // Upload payment proof for a debt
  .post(
    '/debt/:debtId',
    async (ctx) => {
      const { user, params, body, request, set } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const { debtId } = params;
      const { file } = body;

      // Check debt exists and user is a party
      const debt = db.select().from(debts).where(eq(debts.id, debtId)).get();
      if (!debt) {
        set.status = 404;
        return errorResponse(BE_ERRORS.DEBT_NOT_FOUND, 'Debt not found');
      }

      if (debt.debtorId !== user.id && debt.creditorId !== user.id) {
        set.status = 403;
        return errorResponse(BE_ERRORS.DEBT_PERMISSION_DENIED, 'Not authorized for this debt');
      }

      const result = await fileService.uploadFile(file, user.id, 'payment_proof', debtId);

      if (!result.success) {
        set.status = 400;
        return errorResponse(BE_ERRORS.FILE_UPLOAD_FAILED, result.error);
      }

      // Log activity
      await activityService.log({
        userId: user.id,
        action: 'upload',
        resource: 'file',
        resourceId: result.file?.id,
        metadata: { debtId },
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('cf-connecting-ip') ||
          undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({ file: result.file, message: 'Proof uploaded successfully' });
    },
    {
      params: t.Object({ debtId: t.String() }),
      body: t.Object({ file: t.File() })
    }
  )

  // List proofs for a debt
  .get(
    '/debt/:debtId',
    async (ctx) => {
      const { user, params, set } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const { debtId } = params;

      const debt = db.select().from(debts).where(eq(debts.id, debtId)).get();
      if (!debt) {
        set.status = 404;
        return errorResponse(BE_ERRORS.DEBT_NOT_FOUND, 'Debt not found');
      }

      if (debt.debtorId !== user.id && debt.creditorId !== user.id) {
        set.status = 403;
        return errorResponse(BE_ERRORS.DEBT_PERMISSION_DENIED, 'Not authorized for this debt');
      }

      const proofs = await fileService.getProofsForDebt(debtId);

      // Inject signed urls or raw access paths if necessary, but we have /v1/uploads/:id for files
      return successResponse({ proofs });
    },
    {
      params: t.Object({ debtId: t.String() })
    }
  )

  // Review a proof
  .patch(
    '/:proofId/review',
    async (ctx) => {
      const { user, params, body, request, set } = ctx as typeof ctx & { user: User };
      if (!user) {
        set.status = 401;
        return errorResponse(GEN_ERRORS.UNAUTHORIZED);
      }
      const { proofId } = params;
      const { action, reason } = body;

      let result;
      if (action === 'approved') {
        result = await fileService.approveProof(proofId, user.id);
      } else {
        result = await fileService.rejectProof(proofId, user.id, reason);
      }

      if (!result.success) {
        set.status = 400;
        return errorResponse(GEN_ERRORS.INVALID_INPUT, result.error);
      }

      // Log activity
      await activityService.log({
        userId: user.id,
        action: action === 'approved' ? 'approve' : 'reject',
        resource: 'file',
        resourceId: proofId,
        metadata: { debtId: result.debtId, reason },
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('cf-connecting-ip') ||
          undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });

      return successResponse({
        message: `Proof ${action} successfully`,
        allProofsApproved: 'allProofsApproved' in result ? result.allProofsApproved : undefined
      });
    },
    {
      params: t.Object({ proofId: t.String() }),
      body: t.Object({
        action: t.Union([t.Literal('approved'), t.Literal('rejected')]),
        reason: t.Optional(t.String())
      })
    }
  );
