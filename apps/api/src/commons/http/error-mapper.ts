import { BE_ERRORS, GEN_ERRORS } from '@repo/errors';

type ErrorCatalogItem = { code: string; message: string };

const errorByCode: Record<string, ErrorCatalogItem> = {};

for (const error of Object.values(BE_ERRORS)) {
  errorByCode[error.code] = error;
}
for (const error of Object.values(GEN_ERRORS)) {
  errorByCode[error.code] = error;
}

const legacyCodeMap: Record<string, ErrorCatalogItem> = {
  INVALID_OPERATION: BE_ERRORS.INVALID_STATE,
  INVALID_PASSWORD: BE_ERRORS.INVALID_INPUT,
  INVALID_AMOUNT: BE_ERRORS.INVALID_INPUT,
  INVALID_CURRENCY: BE_ERRORS.INVALID_INPUT,
  INVALID_STATUS_TRANSITION: BE_ERRORS.DEBT_INVALID_STATUS,
  DEBT_PERMISSION_DENIED: BE_ERRORS.DEBT_PERMISSION_DENIED,
  INVALID_FILE_TYPE: BE_ERRORS.FILE_INVALID_TYPE,
  FILE_TOO_LARGE: BE_ERRORS.FILE_TOO_LARGE,
  INVALID_NAME: BE_ERRORS.INVALID_INPUT,
  INVALID_EMAIL: BE_ERRORS.INVALID_INPUT,
  SAME_PASSWORD: BE_ERRORS.INVALID_INPUT,
  INVALID_BANK_NAME: BE_ERRORS.INVALID_INPUT,
  INVALID_ACCOUNT_NUMBER: BE_ERRORS.INVALID_INPUT,
  INVALID_ACCOUNT_NAME: BE_ERRORS.INVALID_INPUT,
  INVALID_EXPORT_TYPE: BE_ERRORS.INVALID_INPUT,
  INVALID_EXPORT_FORMAT: BE_ERRORS.INVALID_INPUT,
  INVALID_DATE_FORMAT: BE_ERRORS.INVALID_INPUT,
  INVALID_DATE_RANGE: BE_ERRORS.INVALID_INPUT
};

export function mapServiceError(
  error: { code: string; error?: string },
  fallback: ErrorCatalogItem = BE_ERRORS.INVALID_INPUT
): ErrorCatalogItem {
  const mapped = errorByCode[error.code] ?? legacyCodeMap[error.code] ?? fallback;
  if (!error.error || error.error === mapped.message) {
    return mapped;
  }

  return {
    code: mapped.code,
    message: error.error
  };
}
