/**
 * Shared status colors for import and job statuses
 */
export const IMPORT_STATUS_COLORS: Record<string, string> = {
	success: 'text-green-600',
	processing: 'text-blue-600',
	failed: 'text-red-600',
	pending: 'text-yellow-600',
	preview: 'text-purple-600',
	waiting: 'text-yellow-600'
};

/**
 * Returns the tailwind text color class for a given import status
 */
export function getImportStatusColor(status: string): string {
	return IMPORT_STATUS_COLORS[status?.toLowerCase()] || 'text-gray-600';
}

// Re-export formatDate from shared utils
export { formatDate } from '@repo/utils';
