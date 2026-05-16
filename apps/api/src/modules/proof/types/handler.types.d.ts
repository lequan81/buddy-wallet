import type { AuthenticatedHandlerContext } from '@/types/handler-context';
import type { EntityIdParams } from '@/types/common-params';

export interface RejectProofBody {
  reason?: string;
}

/**
 * All proof routes use `:id` as the param name (Elysia/memoirist requires
 * consistent param names at the same path level). Handlers interpret `params.id`
 * contextually: as debtId for upload/list, as proofId for approve/reject.
 */
export type UploadProofContext = AuthenticatedHandlerContext<{ file: File }, EntityIdParams>;
export type ApproveProofContext = AuthenticatedHandlerContext<unknown, EntityIdParams>;
export type RejectProofContext = AuthenticatedHandlerContext<RejectProofBody, EntityIdParams>;
export type ListProofsContext = AuthenticatedHandlerContext<unknown, EntityIdParams>;
