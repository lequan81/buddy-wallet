/**
 * Global API Configuration & Helpers
 * Centralizes all API-related settings and utilities
 */

// Environment-based URLs (works in both SSR and client)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const WEB_URL = import.meta.env.VITE_WEB_URL || 'http://localhost:5173';

/**
 * Default headers required for all API requests
 * - Origin/Referer: Required by CSRF protection
 * - Content-Type: Standard JSON API
 */
export const getDefaultHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Origin: WEB_URL,
  Referer: `${WEB_URL}/`
});

/**
 * Create headers with authentication token
 */
export const getAuthHeaders = (token?: string): HeadersInit => ({
  ...getDefaultHeaders(),
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

/**
 * Create headers for server-side requests with cookies
 */
export const getServerHeaders = (cookies: string): HeadersInit => ({
  ...getDefaultHeaders(),
  Cookie: cookies
});

/**
 * Default fetch options for API calls
 */
export const defaultFetchOptions: RequestInit = {
  credentials: 'include', // Always send cookies
  headers: getDefaultHeaders()
};

/**
 * Fetch wrapper with default configuration
 * Use this for client-side API calls
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; response: Response }> {
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...defaultFetchOptions,
      ...options,
      headers: {
        ...getDefaultHeaders(),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: data?.message || data?.error || `HTTP ${response.status}`,
        response
      };
    }

    return { data, error: null, response };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
      response: new Response(null, { status: 0 })
    };
  }
}

/**
 * Server-side fetch wrapper (for use in +page.server.ts, hooks.server.ts)
 * Forwards cookies and adds required headers
 */
export async function serverFetch<T>(
  endpoint: string,
  options: RequestInit & { cookies?: string } = {}
): Promise<{ data: T | null; error: string | null; response: Response }> {
  const { cookies, ...fetchOptions } = options;
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...getDefaultHeaders(),
        ...(cookies ? { Cookie: cookies } : {}),
        ...fetchOptions.headers
      }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: data?.message || data?.error || `HTTP ${response.status}`,
        response
      };
    }

    return { data, error: null, response };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
      response: new Response(null, { status: 0 })
    };
  }
}
