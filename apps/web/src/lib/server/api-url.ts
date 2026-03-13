/**
 * Server-only API URL configuration.
 * Uses non-VITE_ prefixed env var so it is NOT exposed to the client bundle.
 */
import { env } from '$env/dynamic/private';
import { API_BASE_URL } from '@repo/config';

export const SERVER_API_URL = env.API_URL || API_BASE_URL;
