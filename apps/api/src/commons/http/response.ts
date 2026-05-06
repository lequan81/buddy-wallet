/**
 * HTTP Response Utilities
 * @logicType http
 *
 * Standardized response envelopes with auto-set HTTP status codes.
 * Handlers no longer need `set.status` before returning.
 *
 * - apiError:   Returns native Response with status from error definition
 * - apiSuccess: Returns 200 Response
 * - apiCreated: Returns 201 Response
 * - apiAccepted: Returns 202 Response
 * - apiNoContent: Returns 204 Response
 */

type ErrorLike = { code: string; message?: string; error?: string; status?: number };

export function apiError(
  error: ErrorLike,
  detail?: string
): Response {
  const status = error.status || 500;
  const msg = detail || error.message || error.error || 'An error occurred';
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: error.code,
        message: msg,
        ...(detail ? { detail } : {})
      }
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export function apiSuccess<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      ...(message ? { message } : {}),
      ...(meta ? { meta } : {})
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export function apiCreated<T>(data: T, message?: string): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      ...(message ? { message } : {})
    }),
    {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export function apiAccepted<T>(data: T, message?: string): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      ...(message ? { message } : {})
    }),
    {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export function apiNoContent(): Response {
  return new Response(null, { status: 204 });
}
