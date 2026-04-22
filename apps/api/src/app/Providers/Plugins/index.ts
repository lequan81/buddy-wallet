/**
 * HTTP Plugins - ElysiaJS plugins extending framework functionality
 *
 * Plugins provide `.derive()` and `.macro()` to extend Elysia's context.
 * They are different from Middlewares which process requests/responses.
 */

// Authentication
export { actor } from './Authentication/ActorPlugin';
export { jwtAuth, jwtPayloadSchema, type JWTPayload } from './Authentication/JwtPlugin';
export { sessionAuth, getUserWithFreshData } from './Authentication/SessionAuthPlugin';

// Authorization
export { accessControl } from './Authorization/AccessControlPlugin';
export {
  requireVerifiedEmail,
  warnUnverifiedEmail,
  canSendEmailFeature
} from './Authorization/EmailVerifiedPlugin';
export {
  permissionPlugin,
  invalidateUserPermissions
} from './Authorization/PermissionPlugin';

// Infrastructure
export { redisPlugin } from './Infrastructure/Redis/RedisPlugin';
export { telemetry } from './Infrastructure/Telemetry';
