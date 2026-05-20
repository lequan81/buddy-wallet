import type { BaseHandlerContext, RequestContext } from '@repo/types/api/handler-context';

export interface RegisterBody {
  email?: string;
  phone: string;
  password: string;
  fullName: string;
}

export interface LoginBody {
  identifier: string;
  password: string;
}

export interface RequestPasswordResetBody {
  identifier: string;
}

export interface RefreshTokenBody {
  refreshToken?: string;
}

export interface ResetPasswordBody {
  token: string;
  newPassword: string;
}

export interface LogoutBody {
  allDevices?: boolean;
}

export interface VerifyEmailBody {
  token: string;
}

export type RegisterContext = RequestContext<RegisterBody>;
export type LoginContext = RequestContext<LoginBody>;
export type RefreshContext = BaseHandlerContext<RefreshTokenBody>;
export type LogoutContext = BaseHandlerContext<LogoutBody>;
export type VerifyEmailContext = BaseHandlerContext<VerifyEmailBody>;
export type RequestResetContext = BaseHandlerContext<RequestPasswordResetBody>;
export type ResetContext = BaseHandlerContext<ResetPasswordBody>;

// ── Email Service Types (canonical home) ────────────────────────────

/** Input shape for sending an email via the SMTP service */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/** Result returned by the email send functions */
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

