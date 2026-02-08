/**
 * Auth Type Definitions
 */
export interface RegisterInput {
  name: string;
  email?: string;
  phoneNumber: string;
  password: string;
}

export interface LoginInput {
  identifier: string; // email or phone
  password: string;
  userAgent: string | null;
  clientIP: string | null;
  clientLocation?: string | null; // Text location from browser geolocation (e.g., "Ho Chi Minh City, Vietnam")
  clientHints?: {
    // From navigator.userAgentData
    browser?: string;
    os?: string;
    mobile?: boolean;
  };
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: { id: string; email: string | null; phoneNumber: string; role: string };
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}
