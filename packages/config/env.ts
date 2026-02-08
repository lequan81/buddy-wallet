export const requiredEnv = (key: string): string => {
  const value = process.env[key] || Bun?.env?.[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
};

export const optionalEnv = (key: string, defaultValue: string): string =>
  process.env[key] || Bun?.env?.[key] || defaultValue;
