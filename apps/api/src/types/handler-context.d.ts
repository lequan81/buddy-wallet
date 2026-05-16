import type { JWTPayload } from '@/modules/auth/plugins/jwt.plugin';

export interface ResponseSetter {
  status?: number | string;
  headers?: unknown;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phoneNumber: string;
  name: string;
  role: string;
  sessionVersion?: number;
  permissions: string[];
  isActive?: boolean;
  emailVerified?: boolean;
  failedLoginAttempts?: number;
  isLocked?: boolean;
  lockoutUntil?: Date | null;
}

export interface JwtSigner {
  sign(payload: JWTPayload): Promise<string | false>;
}

export interface BaseHandlerContext<TBody = unknown, TParams = Record<string, string>, TQuery = Record<string, unknown>> {
  body: TBody;
  params: TParams;
  query: TQuery;
  set: ResponseSetter;
  cookie: any;
  user?: AuthenticatedUser | null;
  sessionId?: string | null;
  jwt?: JwtSigner;
}

export interface AuthenticatedHandlerContext<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>
> extends BaseHandlerContext<TBody, TParams, TQuery> {
  user: AuthenticatedUser;
}

export interface RequestContext<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>
> extends BaseHandlerContext<TBody, TParams, TQuery> {
  request: Request;
}
