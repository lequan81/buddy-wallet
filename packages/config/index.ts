/**
 * @repo/config - Shared Configuration & Constants
 *
 * Contains shared constants used by both frontend and backend.
 * Organized into shared, backend, and frontend specific constants.
 */

export * from './shared';
export * from './backend';
export * from './frontend';

// Legacy exports for backward compatibility
export const ACCEPTED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;
export const ACCEPTED_IMPORT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
  'application/csv'
] as const;
export const MAX_IMPORT_ROWS = 10000;
export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_DIRECT_PROCESS_SIZE_BYTES = 200 * 1024;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEBT_MIN_AMOUNT = 1000;
export const DEBT_MAX_AMOUNT = 1000000000000;
export const MAX_BATCH_DELETE_SIZE = 50;
export const DUPLICATE_CHECK_DAYS = 7;
export const DUPLICATE_AMOUNT_TOLERANCE = 0.1;
export const MAX_DAILY_IMPORT_ROWS = 500;
export const MAX_PENDING_DEBTS = 200;

// Helper to get env var safely across environments (Vite, Bun, Node)
const getEnv = (key: string, def: string) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key])
      return import.meta.env[key];
    if (typeof Bun !== 'undefined' && Bun.env && Bun.env[key]) return Bun.env[key];
    if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  } catch {
    // Ignore error
  }
  return def;
};

/** Check if file extension is valid for import */
export const isValidImportFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ACCEPTED_IMPORT_EXTENSIONS.includes(ext as (typeof ACCEPTED_IMPORT_EXTENSIONS)[number]);
};

/** Get accept string for file input */
export const getImportAcceptString = (): string => ACCEPTED_IMPORT_EXTENSIONS.join(',');

// Legacy API URLs
export const API_BASE_URL = getEnv('VITE_API_URL', 'http://localhost:3000');
export const WEB_BASE_URL = getEnv('VITE_WEB_URL', 'http://localhost:5173');

// Legacy storage directories
export const UPLOAD_TMP_DIR = getEnv('UPLOAD_TMP_DIR', '../../tmp/uploads');
export const PROOF_TMP_DIR = getEnv('PROOF_TMP_DIR', '../../tmp/proofs');

// Legacy image config
export const MAX_IMAGE_FILE_SIZE = 4 * 1024 * 1024;
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
] as const;

// Export other legacy modules
export * from './security';
export * from './env';

// Legacy banks data
export const MAJOR_BANKS_FALLBACK = [
  {
    id: 17,
    name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    code: 'VCB',
    bin: '970436',
    shortName: 'Vietcombank',
    logo: 'https://img.vietqr.io/image/VCB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 42,
    name: 'Ngân hàng TMCP Kỹ thương Việt Nam',
    code: 'TCB',
    bin: '970407',
    shortName: 'Techcombank',
    logo: 'https://img.vietqr.io/image/TCB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 2,
    name: 'Ngân hàng TMCP Công Thương Việt Nam',
    code: 'CTG',
    bin: '970415',
    shortName: 'VietinBank',
    logo: 'https://img.vietqr.io/image/CTG-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 4,
    name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    code: 'BIDV',
    bin: '970418',
    shortName: 'BIDV',
    logo: 'https://img.vietqr.io/image/BIDV-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 10,
    name: 'Ngân hàng TMCP Á Châu',
    code: 'ACB',
    bin: '970416',
    shortName: 'ACB',
    logo: 'https://img.vietqr.io/image/ACB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 21,
    name: 'Ngân hàng TMCP Quân đội',
    code: 'MB',
    bin: '970422',
    shortName: 'MBBank',
    logo: 'https://img.vietqr.io/image/MB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  },
  {
    id: 47,
    name: 'Ngân hàng TMCP Tiên Phong',
    code: 'TPB',
    bin: '970423',
    shortName: 'TPBank',
    logo: 'https://img.vietqr.io/image/TPB-logo.png',
    transferSupported: 1,
    lookupSupported: 1
  }
];

// Legacy external services
export const VIETQR_API_URL = getEnv('VIETQR_API_URL', 'https://api.vietqr.io/v2/banks');
export const VIETQR_TIMEOUT = Number(getEnv('VIETQR_TIMEOUT', '5000'));
