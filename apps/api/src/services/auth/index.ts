/**
 * Auth Services - Index
 * 
 * Split from original AuthService following SRP:
 * - AuthCoreService: Registration and debt linking
 * - AuthSecurityService: Login with security checks
 * - AuthSessionService: Logout and password changes
 * 
 * Re-export for backward compatibility
 */
export { AuthCoreService } from './auth-core.service';
export { AuthSecurityService } from './auth-security.service';
export { AuthSessionService } from './auth-session.service';

// No legacy exports anymore
