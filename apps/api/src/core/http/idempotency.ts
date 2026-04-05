export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_REPLAY_HEADER = 'Idempotency-Replay';

type MutableHeaders = Record<string, string>;

const getMutableHeaders = (set: { headers?: unknown }): MutableHeaders => {
  if (!set.headers || typeof set.headers !== 'object') {
    set.headers = {};
  }
  return set.headers as MutableHeaders;
};

export const setIdempotencyHeaders = (
  set: { headers?: unknown },
  key: string,
  options?: { replay?: boolean }
): void => {
  const headers = getMutableHeaders(set);
  headers[IDEMPOTENCY_KEY_HEADER] = key;
  headers['X-Idempotency-Key'] = key;

  if (options?.replay) {
    headers[IDEMPOTENCY_REPLAY_HEADER] = 'true';
    headers['X-Idempotency-Replay'] = 'true';
  }
};

export const getIdempotencyKey = (headers: Record<string, string | undefined>): string | undefined => {
  return headers['idempotency-key'] || headers[IDEMPOTENCY_KEY_HEADER];
};
