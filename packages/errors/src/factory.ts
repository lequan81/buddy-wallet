/**
 * Error Definition Factory
 *
 * Provides a type-safe way to define error catalogs with
 * consistent shape: { code, message, status, createError() }
 */

export interface ErrorDefinition {
	code: string;
	message: string;
	status: number;
}

export interface ErrorEntry extends ErrorDefinition {
	createError(detail?: string): {
		code: string;
		message: string;
		status: number;
		detail?: string;
	};
}

export function defineErrors<T extends Record<string, ErrorDefinition>>(
	definitions: T
): { [K in keyof T]: ErrorEntry } {
	const entries = {} as Record<string, ErrorEntry>;

	for (const [key, def] of Object.entries(definitions)) {
		entries[key] = {
			code: def.code,
			message: def.message,
			status: def.status,
			createError(detail?: string) {
				return {
					code: def.code,
					message: detail || def.message,
					status: def.status,
					...(detail ? { detail } : {})
				};
			}
		};
	}

	return Object.freeze(entries) as { [K in keyof T]: ErrorEntry };
}
