export * from './format';
export * from './file-validation';
export * from './cursor';
export * from './retry';
export * from './csv';

/**
 * Converts a string to an optional string (undefined if empty).
 */
export const toOptional = (value: string | undefined): string | undefined => 
  (value && value.trim() ? value : undefined);
