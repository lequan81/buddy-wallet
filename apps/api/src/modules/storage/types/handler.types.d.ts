import type { AuthenticatedHandlerContext } from '@repo/types/api/handler-context';
import type { EntityIdParams, ResourceIdParams, IdParams } from '@repo/types/api/common-params';
import type { ListQuery } from '@repo/types/api/common-queries';

export interface UploadFileBody {
  file: File;
}

export interface DeleteFileBody {
  key: string;
}

export type FileKeyParams = ResourceIdParams;

export type ListFilesQuery = ListQuery & {
  prefix?: string;
};

export type DebtIdParams = IdParams<'debtId'>;

export type ProofIdParams = EntityIdParams;

export interface RejectProofBody {
  reason?: string;
}

export type UploadFileContext = AuthenticatedHandlerContext<UploadFileBody>;
export type RemoveFileContext = AuthenticatedHandlerContext<DeleteFileBody>;
export type GetFileUrlContext = AuthenticatedHandlerContext<unknown, FileKeyParams>;
export type ListFilesContext = AuthenticatedHandlerContext<unknown, Record<string, string>, ListFilesQuery>;
export type UploadProofContext = AuthenticatedHandlerContext<UploadFileBody, DebtIdParams>;
export type ApproveProofContext = AuthenticatedHandlerContext<unknown, ProofIdParams>;
export type RejectProofContext = AuthenticatedHandlerContext<RejectProofBody, ProofIdParams>;

