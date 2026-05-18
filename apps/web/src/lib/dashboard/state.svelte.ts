import { SvelteSet } from 'svelte/reactivity';
import { DEBT_STATUS } from '@repo/config/shared/status';
import type { Debt } from '@repo/types/shared/debt';

type SortField = 'description' | 'status' | 'amount' | 'date';
type SortDirection = 'asc' | 'desc';

export class DashboardState {
	userId: string;
	
	// Selection state
	selectedIds = new SvelteSet<string>();
	isSubmitting = $state(false);
	deleteId = $state('');
	isDeleting = $state(false);

	// Search state
	searchQuery = $state('');
	debouncedSearch = $state('');

	// Sorting state
	sortField = $state<SortField>('date');
	sortDirection = $state<SortDirection>('desc');

	// Client-side filter / pagination state
	statusFilter = $state('all');
	currentPage = $state(1);
	pageSize = $state(10);

	constructor(userId: string) {
		this.userId = userId;
		
		// Debounce search
		$effect(() => {
			const timeout = setTimeout(() => {
				this.debouncedSearch = this.searchQuery;
			}, 300);
			return () => clearTimeout(timeout);
		});
	}

	// Check if a debt can be deleted by the current user
	canDeleteDebt(debt: { uploadedById?: string; status?: string }) {
		if (!this.userId) return false;
		const isUploader = debt.uploadedById === this.userId;
		const isPaid = debt.status === DEBT_STATUS.PAID;
		return isUploader && !isPaid;
	}

	// Selection helpers
	toggleSelect(id: string) {
		const newSet = new SvelteSet(this.selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		this.selectedIds = newSet;
	}

	toggleSelectAll(items: { id: string }[]) {
		const allSelected = items.every((d) => this.selectedIds.has(d.id));

		if (allSelected) {
			const newSet = new SvelteSet(this.selectedIds);
			for (const d of items) {
				newSet.delete(d.id);
			}
			this.selectedIds = newSet;
		} else {
			const newSet = new SvelteSet(this.selectedIds);
			for (const d of items) {
				newSet.add(d.id);
			}
			this.selectedIds = newSet;
		}
	}

	clearSelection() {
		this.selectedIds = new SvelteSet();
	}

	// Sorting
	toggleSort(field: SortField) {
		if (this.sortField === field) {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortField = field;
			this.sortDirection = 'desc';
		}
	}

	setStatusFilter(status: string) {
		this.clearSelection();
		this.statusFilter = status;
		this.currentPage = 1;
	}

	setPage(page: number) {
		this.currentPage = page;
	}

	setPageSize(size: number) {
		this.pageSize = size;
		this.currentPage = 1;
	}

	// Business logic helpers
	getFinancialSummary(debts: Debt[]) {
		return {
			totalOwedToYou: debts
				.filter(
					(d: Debt) =>
						d.creditorId === this.userId &&
						d.status !== DEBT_STATUS.PAID &&
						d.status !== DEBT_STATUS.CANCELLED
				)
				.reduce((acc: number, d: Debt) => acc + d.amount, 0),
			totalYouOwe: debts
				.filter(
					(d: Debt) =>
						d.debtorId === this.userId &&
						d.status !== DEBT_STATUS.PAID &&
						d.status !== DEBT_STATUS.CANCELLED
				)
				.reduce((acc: number, d: Debt) => acc + d.amount, 0)
		};
	}

	getDebtsNeedingConfirmation(debts: Debt[]) {
		return debts.filter((d: Debt) => {
			if (!d.needsConfirmation) return false;
			if (d.uploadedById === this.userId) return false;
			const isCreditor = d.creditorId === this.userId;
			const isDebtor = d.debtorId === this.userId;
			if (isCreditor && !d.confirmedByCreditor) return true;
			if (isDebtor && !d.confirmedByDebtor) return true;
			return false;
		});
	}
}

