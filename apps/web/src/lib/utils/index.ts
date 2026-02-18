import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export function formatDuration(ms: number) {
	if (ms < 1) return '< 1ms';
	return `${ms.toFixed(2)}ms`;
}

export const TRACE_STATUS_COLORS = {
	OK: 'bg-green-500',
	ERROR: 'bg-red-500',
	UNSET: 'bg-gray-500'
} as const;

export type TraceStatusResult = keyof typeof TRACE_STATUS_COLORS;
