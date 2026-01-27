// Centralized error configuration
import type { ErrorInfo } from '$lib/types/errors';

export type { ErrorInfo };

export const errorConfig: Record<number, ErrorInfo> = {
  400: {
    title: 'Bad Request',
    description: 'The request was invalid or malformed.',
    emoji: '🤔'
  },
  401: {
    title: 'Unauthorized',
    description: 'You need to be logged in to access this page.',
    emoji: '🔐'
  },
  403: {
    title: 'Forbidden',
    description: "You don't have permission to access this resource.",
    emoji: '🚫'
  },
  404: {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist.',
    emoji: '😕'
  },
  408: {
    title: 'Request Timeout',
    description: 'The request took too long to complete.',
    emoji: '⏱️'
  },
  429: {
    title: 'Too Many Requests',
    description: 'You are sending too many requests. Please slow down.',
    emoji: '🚦'
  },
  500: {
    title: 'Server Error',
    description: 'Something went wrong on our end. Please try again later.',
    emoji: '💥'
  },
  502: {
    title: 'Bad Gateway',
    description: 'The server is temporarily unavailable.',
    emoji: '🌐'
  },
  503: {
    title: 'Service Unavailable',
    description: 'The server is under maintenance. Please try again later.',
    emoji: '🔧'
  },
  504: {
    title: 'Gateway Timeout',
    description: 'The server did not respond in time.',
    emoji: '⏰'
  }
};

export const defaultErrorInfo: ErrorInfo = {
  title: 'Oops! Something went wrong',
  description: 'An unexpected error occurred.',
  emoji: '⚠️'
};

export function getErrorInfo(status: number): ErrorInfo {
  return errorConfig[status] || defaultErrorInfo;
}

export function getErrorMessage(status: number, errorMessage?: string): string {
  if (errorMessage) return errorMessage;

  switch (status) {
    case 401:
      return 'Please log in to continue.';
    case 403:
      return 'Contact support if you believe you should have access.';
    case 404:
      return 'The page you are looking for might have been removed or is temporarily unavailable.';
    default:
      if (status >= 500) return 'Our team has been notified and is working on a fix.';
      return 'Please try again or contact support if the problem persists.';
  }
}
