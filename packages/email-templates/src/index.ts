/**
 * @repo/email-templates
 *
 * Svelte-based email templates using better-svelte-email.
 * Compiled via Vite SSR build.
 */

import Renderer from 'better-svelte-email/render';
import OtpEmail from './templates/OtpEmail.svelte';
import WelcomeEmail from './templates/WelcomeEmail.svelte';

// Create renderer instance
const renderer = new Renderer();

// ============================================
// TYPES
// ============================================

export interface OtpEmailData {
  otp: string;
  name?: string;
}

export interface WelcomeEmailData {
  name: string;
  loginUrl?: string;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render OTP verification email
 */
export async function renderOtp(data: OtpEmailData): Promise<string> {
  return renderer.render(OtpEmail, { props: data });
}

/**
 * Render welcome email
 */
export async function renderWelcome(data: WelcomeEmailData): Promise<string> {
  return renderer.render(WelcomeEmail, { props: data });
}
