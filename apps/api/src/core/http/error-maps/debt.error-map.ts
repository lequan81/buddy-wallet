import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';
import type { ServiceErrorMap, ServiceErrorMapEntry } from '@/core/http/result-helper';

export const DEBT_ERROR_MAP: ServiceErrorMap = {
  [BE_ERRORS.DEBT_NOT_FOUND.code]: { status: 404, error: BE_ERRORS.DEBT_NOT_FOUND },
  [BE_ERRORS.DEBT_PERMISSION_DENIED.code]: { status: 403, error: BE_ERRORS.DEBT_PERMISSION_DENIED },
  [BE_ERRORS.DEBT_DUPLICATE_WARNING.code]: { status: 409, error: BE_ERRORS.DEBT_DUPLICATE_WARNING },
  [BE_ERRORS.DEBT_INVALID_STATUS.code]: { status: 400, error: BE_ERRORS.DEBT_INVALID_STATUS },
  [BE_ERRORS.DEBT_INVALID_STATE.code]: { status: 400, error: BE_ERRORS.DEBT_INVALID_STATE },
  [BE_ERRORS.DEBT_ALREADY_CONFIRMED.code]: { status: 409, error: BE_ERRORS.DEBT_ALREADY_CONFIRMED },
  [BE_ERRORS.DEBT_PENDING_LIMIT.code]: { status: 400, error: BE_ERRORS.DEBT_PENDING_LIMIT },
  [BE_ERRORS.DEBT_PHONE_REQUIRED.code]: { status: 400, error: BE_ERRORS.DEBT_PHONE_REQUIRED },
  [BE_ERRORS.DEBT_INVALID_PHONE.code]: { status: 400, error: BE_ERRORS.DEBT_INVALID_PHONE },
  [BE_ERRORS.DEBT_SELF_NOT_ALLOWED.code]: { status: 400, error: BE_ERRORS.DEBT_SELF_NOT_ALLOWED },
  [GEN_ERRORS.VALIDATION.code]: { status: 400, error: GEN_ERRORS.VALIDATION },
  [GEN_ERRORS.INVALID_INPUT.code]: { status: 400, error: GEN_ERRORS.INVALID_INPUT }
};

export const DEFAULT_DEBT_FAILURE: ServiceErrorMapEntry = {
  status: 400,
  error: GEN_ERRORS.INVALID_INPUT
};

