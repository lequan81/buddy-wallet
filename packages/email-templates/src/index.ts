/**
 * @repo/email-templates
 *
 * Svelte-based email templates using better-svelte-email.
 * Compiled via Vite SSR build.
 */

import Renderer from 'better-svelte-email/render';
import OtpEmail from './templates/OtpEmail.svelte';
import WelcomeEmail from './templates/WelcomeEmail.svelte';
import type { OtpEmailData, WelcomeEmailData } from './types/index';

// Create renderer instance
const renderer = new Renderer();

// Re-export types
export type { OtpEmailData, WelcomeEmailData };

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render OTP verification email
 * DOCTYPE is now auto-injected by the Html component
 */
export async function renderOtp(data: OtpEmailData): Promise<string> {
  const html = await renderer.render(OtpEmail, { props: data });
  return html
    .replace(/<!--\[-->/g, '')
    .replace(/<!--\]-->/g, '')
    .replace(/<!---->/g, '');
}

/**
 * Render welcome email
 * DOCTYPE is now auto-injected by the Html component
 */
export async function renderWelcome(data: WelcomeEmailData): Promise<string> {
  const html = await renderer.render(WelcomeEmail, { props: data });
  return html
    .replace(/<!--\[-->/g, '')
    .replace(/<!--\]-->/g, '')
    .replace(/<!---->/g, '');
}
