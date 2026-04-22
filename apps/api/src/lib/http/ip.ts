import type { Server } from 'bun';

/**
 * Get client IP from request and server
 * SECURITY: Handles proxies and direct Connections
 */
/**
 * Get client IP from request and server
 * SECURITY: Handles proxies and direct Connections
 */
export function getClientIP(request: Request, server: Server<any> | null): string | null {
  // 1. Try Bun's native requestIP (most reliable if not behind proxy)
  const nativeIp = server?.requestIP(request)?.address;
  if (nativeIp) return nativeIp;
 
  // 2. Check standard proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Get first IP in chain (closest to client)
    return forwardedFor.split(',')[0].trim();
  }
 
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
 
  return null;
}
 
/**
 * Get all IPs from X-Forwarded-For chain
 */
export function getForwardedIPChain(request: Request): string[] {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) return [];
  return forwardedFor.split(',').map(ip => ip.trim()).filter(Boolean);
}
 
/**
 * Get the immediate proxy IP (last in chain)
 */
export function getImmediateProxyIP(request: Request): string | null {
  const chain = getForwardedIPChain(request);
  return chain.length > 0 ? chain[chain.length - 1] : null;
}

