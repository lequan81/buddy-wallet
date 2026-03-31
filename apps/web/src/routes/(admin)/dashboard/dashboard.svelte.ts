import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { SvelteSet, SvelteURL } from 'svelte/reactivity';
import { DEBT_STATUS } from '@repo/config';

type SortField = 'description' | 'status' | 'amount' | 'date';
type SortDirection = 'asc' | 'desc';

export function createDashboardState(userId: string) {
	// Selection state
	let selectedIds = new SvelteSet<string>();
	let isSubmitting = $state(false);
	let deleteId = $state('');
	let isDeleting = $state(false);

	// Search state
	let searchQuery = $state('');
	let debouncedSearch = $state('');

	// Sorting state
	let sortField = $state<SortField>('date');
	let sortDirection = $state<SortDirection>('desc');

	// Debounce search
	$effect(() => {
		const timeout = setTimeout(() => {
			debouncedSearch = searchQuery;
		}, 300);
		return () => clearTimeout(timeout);
	});

	// Check if a debt can be deleted by the current user
	const canDeleteDebt = (debt: { uploadedById?: string; status?: string }) => {
		if (!userId) return false;
		const isUploader = debt.uploadedById === userId;
		const isPaid = debt.status === DEBT_STATUS.PAID;
		return isUploader && !isPaid;
	};

	// Selection helpers
	const toggleSelect = (id: string) => {
		const newSet = new SvelteSet(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	};

	const toggleSelectAll = (items: { id: string }[]) => {
		const allSelected = items.every((d) => selectedIds.has(d.id));

		if (allSelected) {
			const newSet = new SvelteSet(selectedIds);
			for (const d of items) {
				newSet.delete(d.id);
			}
			selectedIds = newSet;
		} else {
			const newSet = new SvelteSet(selectedIds);
			for (const d of items) {
				newSet.add(d.id);
			}
			selectedIds = newSet;
		}
	};

	const clearSelection = () => {
		selectedIds = new SvelteSet();
	};

	// Sorting
	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'desc';
		}
	};

	// Navigation with params
	const navigateWithParams = (params: { page?: number; pageSize?: number; status?: string }) => {
		const url = new SvelteURL(get(page).url);
		if (params.page !== undefined) url.searchParams.set('page', params.page.toString());
		if (params.pageSize !== undefined) url.searchParams.set('pageSize', params.pageSize.toString());
		if (params.status !== undefined) {
			if (params.status === 'all') {
				url.searchParams.delete('status');
			} else {
				url.searchParams.set('status', params.status);
			}
		}
		goto(url.toString(), { invalidateAll: true });
	};

	// Handle filter change
	const handleFilterChange = (newStatus: string) => {
		clearSelection();
		navigateWithParams({ status: newStatus, page: 1 });
	};

	return {
		// Selection
		get selectedIds() {
			return selectedIds;
		},
		get isSubmitting() {
			return isSubmitting;
		},
		set isSubmitting(v: boolean) {
			isSubmitting = v;
		},
		get deleteId() {
			return deleteId;
		},
		set deleteId(v: string) {
			deleteId = v;
		},
		get isDeleting() {
			return isDeleting;
		},
		set isDeleting(v: boolean) {
			isDeleting = v;
		},

		// Search
		get searchQuery() {
			return searchQuery;
		},
		set searchQuery(v: string) {
			searchQuery = v;
		},
		get debouncedSearch() {
			return debouncedSearch;
		},

		// Sorting
		get sortField() {
			return sortField;
		},
		get sortDirection() {
			return sortDirection;
		},

		// Methods
		canDeleteDebt,
		toggleSelect,
		toggleSelectAll,
		clearSelection,
		toggleSort,
		navigateWithParams,
		handleFilterChange
	};
}
