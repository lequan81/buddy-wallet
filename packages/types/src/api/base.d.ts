/**
 * Base Types
 */
export interface BaseResult {
  success: boolean;
  message?: string;
  code?: string;
  error?: string;
}

export type ExpiryOption = '1d' | '3d' | '7d';
