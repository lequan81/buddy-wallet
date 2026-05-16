/**
 * Error Definition Factory
 *
 * Provides a type-safe way to define error catalogs with
 * consistent shape: { code, message, status, createError() }
 */

export interface ErrorDefinition<S extends number = number, C extends string = string> {
	code: C;
	message: string;
	status: S;
}

export interface ErrorEntry<S extends number = number, C extends string = string> extends ErrorDefinition<S, C> {
	createError(detail?: string): {
		code: C;
		message: string;
		status: S;
		detail?: string;
	};
}

export function defineErrors<T extends Record<string, ErrorDefinition<number, string>>>(
	definitions: T
): { [K in keyof T]: ErrorEntry<
	T[K] extends ErrorDefinition<infer S, string> ? S : number,
	T[K] extends ErrorDefinition<number, infer C> ? C : string
> } {
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

	return Object.freeze(entries) as any;
}
