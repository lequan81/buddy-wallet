import type { Server } from 'bun';

/**
 * Get client IP from request and server
 * SECURITY: Handles proxies and direct connections
 */
export function getClientIP(request: Request, server: Server<any> | null): string | null {

  // 1. Try Bun's native requestIP (most reliable if not behind proxy)
  const nativeIp = server?.requestIP(request)?.address;
  if (nativeIp) return nativeIp;

  // 2. Check standard proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return null;
}
