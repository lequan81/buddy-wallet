import type { Result } from '../api/base';
import type { SafeUser } from '../core/user';
import type { ClientHints, ClientLocation, Coordinates } from '../infrastructure/sessions';

export interface RegisterInput {
  phoneNumber: string;
  password: string;
  name: string;
  email?: string;
}

export interface LoginInput {
  identifier: string;
  password?: string;
  otp?: string;
  userAgent?: string | null;
  clientIP?: string | null;
  clientHints?: ClientHints;
  coordinates?: Coordinates | null;
  clientLocation?: ClientLocation;
}

export interface AuthResultData {
  accessToken?: string;  // Optional for register (no tokens yet)
  refreshToken?: string; // Optional for register (no tokens yet)
  sessionId?: string;
  expiresIn?: number;
  user?: SafeUser;
  isNewUser?: boolean;
  mustChangePassword?: boolean;
}

/**
 * Result type for auth operations
 */
export type AuthResult = Result<AuthResultData>;

export interface JwtService {
  sign(payload: object): Promise<string>;
  verify(token: string): Promise<object | false>;
}

export interface IAuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput, jwt: JwtService): Promise<AuthResult>;
  logout(refreshToken: string, userId?: string): Promise<Result<void>>;
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<Result<void>>;
}
