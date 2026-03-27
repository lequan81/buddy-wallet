/**
 * Cursor utilities for pagination
 */
export interface CursorPayload {
  createdAt: string;
  id: string;
}

export const encodeCursor = (payload: CursorPayload): string => {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
};

export const decodeCursor = (
  cursor: string | null | undefined
): { createdAt: Date; id: string } | null => {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    if (!parsed?.createdAt || !parsed?.id) return null;

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;

    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
};
