import type { Snippet } from 'svelte';

export interface EmailLayoutProps {
  title: string;
  preview: string;
  children: Snippet;
}

export interface OtpEmailData {
  otp: string;
  name?: string;
}

export interface WelcomeEmailData {
  name: string;
  loginUrl?: string;
}
