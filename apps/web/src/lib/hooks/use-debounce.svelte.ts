/**
 * Debounce hook for Svelte 5 runes
 * Useful for search inputs, API calls, etc.
 */

/**
 * Creates a debounced value that updates after a delay
 * @param initialValue - Initial value
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 */
export function useDebounce<T>(initialValue: T, delay: number = 300) {
	let value = $state(initialValue);
	let debouncedValue = $state(initialValue);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (timeoutId) clearTimeout(timeoutId);

		timeoutId = setTimeout(() => {
			debouncedValue = value;
		}, delay);

		return () => {
			if (timeoutId) clearTimeout(timeoutId);
		};
	});

	return {
		/** Current (non-debounced) value */
		get value() {
			return value;
		},
		set value(v: T) {
			value = v;
		},
		/** Debounced value - updates after delay */
		get debounced() {
			return debouncedValue;
		},
		/** Check if currently debouncing */
		get isPending() {
			return value !== debouncedValue;
		}
	};
}

/**
 * Creates a debounced callback function
 * @param callback - Function to debounce
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
	callback: T,
	delay: number = 300
) {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const debouncedFn = (...args: Parameters<T>) => {
		if (timeoutId) clearTimeout(timeoutId);

		timeoutId = setTimeout(() => {
			callback(...args);
		}, delay);
	};

	const cancel = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};

	const flush = (...args: Parameters<T>) => {
		cancel();
		callback(...args);
	};

	return {
		/** Call the debounced function */
		call: debouncedFn,
		/** Cancel pending execution */
		cancel,
		/** Execute immediately and cancel pending */
		flush
	};
}
