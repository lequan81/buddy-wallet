import { GEN_ERRORS, errorResponse } from '@repo/errors';
import { MAX_IMPORT_FILE_SIZE, ACCEPTED_IMPORT_MIME_TYPES } from '@repo/config';
import { isValidSpreadsheetBytes } from '@repo/utils';

type ValidationFailure = {
  status: number;
  body: ReturnType<typeof errorResponse>;
};

export async function validateImportUploadFile(file: File): Promise<ValidationFailure | null> {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return {
      status: 400,
      body: errorResponse(
        GEN_ERRORS.INVALID_INPUT,
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${MAX_IMPORT_FILE_SIZE / 1024 / 1024}MB`
      )
    };
  }

  if (!ACCEPTED_IMPORT_MIME_TYPES.includes(file.type as (typeof ACCEPTED_IMPORT_MIME_TYPES)[number])) {
    return {
      status: 400,
      body: errorResponse(
        GEN_ERRORS.INVALID_INPUT,
        `Invalid file type '${file.type}'. Allowed: .xlsx, .xls, .csv`
      )
    };
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!isValidSpreadsheetBytes(header)) {
    return {
      status: 400,
      body: errorResponse(GEN_ERRORS.INVALID_INPUT, 'File content does not match XLSX or CSV format')
    };
  }

  return null;
}

