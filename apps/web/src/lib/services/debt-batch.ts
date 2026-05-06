export const normalizeDebtIdList = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
	}

	if (typeof value === 'string') {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return [];
};
