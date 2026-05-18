/**
 * Debt Service - Barrel Module re-exporting micro-services
 * @logicType backend
 */

import type { ErrorLike } from '@/commons/http/response';

export type ServiceResult<T> = { data: T } | { error: ErrorLike };

export * from './validation.service';
export * from './create-debt.service';
export * from './confirm-debt.service';
export * from './suggest-edit.service';
export * from './respond-suggestion.service';
export * from './update-debt.service';
export * from './cancel-debt.service';
export * from './complete-debt.service';
export * from './remove-debt.service';
