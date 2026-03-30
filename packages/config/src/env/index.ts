/**
 * Environment utilities for cross-runtime (Vite, Bun, Node)
 */

export const optionalEnv = (key: string, defaultValue: string): string => {
  try {
    // 1. Vite / Frontend (Meta)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const val = (import.meta as any).env[key];
      if (val !== undefined) return val;
    }

    // 2. Bun (Bun.env)
    if (typeof Bun !== 'undefined' && Bun.env) {
      const val = Bun.env[key];
      if (val !== undefined) return val;
    }

    // 3. Node (process.env)
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[key];
      if (val !== undefined) return val;
    }
  } catch (e) {
    // Suppress errors during env lookup
  }

  return defaultValue;
};

export const getEnvInt = (key: string, defaultValue: number): number => {
  const val = optionalEnv(key, '');
  return val ? parseInt(val, 10) : defaultValue;
};

export const getEnvBool = (key: string, defaultValue: boolean): boolean => {
  const val = optionalEnv(key, '');
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  return defaultValue;
};
