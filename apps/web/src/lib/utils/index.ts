import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}


export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;

export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;
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
