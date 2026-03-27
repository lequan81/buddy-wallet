export const requiredEnv = (key: string): string => {
  const value = process.env[key] || Bun?.env?.[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
};

export const optionalEnv = (key: string, defaultValue: string): string =>
  process.env[key] || Bun?.env?.[key] || defaultValue;

export const getEnvBool = (key: string, defaultValue: boolean = false): boolean => {
  const value = process.env[key] || Bun?.env?.[key];
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === 'true';
};

export const getEnvInt = (key: string, defaultValue: number): number => {
  const value = process.env[key] || Bun?.env?.[key];
  if (value === undefined || value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const getEnvFloat = (key: string, defaultValue: number): number => {
  const value = process.env[key] || Bun?.env?.[key];
  if (value === undefined || value === null) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};
