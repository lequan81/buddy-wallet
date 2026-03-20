import { api } from '$lib/services/api';
import type { PageData } from './$types';
import type { BankAccount } from '@repo/types';

export class DebtDetailState {
	debt = $state<NonNullable<PageData['debt']>>();
	
	private creditorBanks: NonNullable<PageData['creditorBanks']>;
	private currentUser: NonNullable<PageData['currentUser']>;
	private isUploader: boolean;
	private isCreditor: boolean;
	private isDebtor: boolean;

	// Modal state
	showPayModal = $state(false);
	showMarkAsPaidModal = $state(false);
	showSuggestModal = $state(false);

	// General state
	isSubmitting = $state(false);
	isEditing = $state(false);
	editDescription = $state('');
	editAmount = $state('');

	// Bank state
	selectedBankId = $state('');

	// Upload State
	uploadFile = $state<FileList | undefined>(undefined);
	isUploading = $state(false);
	uploadError = $state('');
	uploadSuccess = $state(false);

	lastApprovedDebtId = $state('');

	// Suggest Edit state
	suggestAmount = $state('');
	suggestDescription = $state('');
	isSuggesting = $state(false);

	constructor(
		debt: NonNullable<PageData['debt']>,
		creditorBanks: NonNullable<PageData['creditorBanks']>,
		currentUser: NonNullable<PageData['currentUser']>,
		isUploader: boolean,
		isCreditor: boolean,
		isDebtor: boolean
	) {
		this.debt = debt;
		this.creditorBanks = creditorBanks;
		this.currentUser = currentUser;
		this.isUploader = isUploader;
		this.isCreditor = isCreditor;
		this.isDebtor = isDebtor;

		this.editDescription = debt?.description || '';
		this.editAmount = debt?.amount?.toString() || '';

		if (creditorBanks.length > 0) {
			const def = creditorBanks.find((b: BankAccount) => b.isDefault);
			this.selectedBankId = def ? def.id : creditorBanks[0].id;
		}
	}

	get selectedBank() {
		return (
			this.creditorBanks.find((b: BankAccount) => b.id === this.selectedBankId) ||
			this.creditorBanks.find((b: BankAccount) => b.isDefault) ||
			this.creditorBanks[0]
		);
	}

	get status() {
		return this.debt?.status?.toLowerCase();
	}

	get canEdit() {
		return this.isUploader && this.status === 'pending';
	}

	get canDelete() {
		return this.isUploader && this.status !== 'paid';
	}

	get canSuggestEdit() {
		return !this.isUploader && (this.isCreditor || this.isDebtor) && this.status !== 'paid' && this.status !== 'cancelled';
	}

	get canConfirm() {
		return !this.isUploader && (this.isCreditor || this.isDebtor) && this.status === 'pending';
	}

	get hasPendingSuggestion() {
		const d = this.debt as (NonNullable<PageData['debt']> & { suggestedById?: string });
		return d?.suggestedById && this.isUploader;
	}

	get validTransitions() {
		const currentStatus = this.status || '';
		const transitions: Record<string, { status: string; label: string; icon: string; disabled?: boolean }[]> = {
			pending: [
				{ status: 'confirmed', label: 'Confirm', icon: 'Check' },
				{ status: 'disputed', label: 'Dispute', icon: 'AlertTriangle' },
				{ status: 'cancelled', label: 'Cancel', icon: 'X' }
			],
			confirmed: [
				{
					status: 'paid',
					label: 'Mark as Paid',
					icon: 'Check',
					disabled: !(this.debt as (NonNullable<PageData['debt']> & { hasPendingProof?: boolean }))?.hasPendingProof
				},
				{ status: 'disputed', label: 'Dispute', icon: 'AlertTriangle' }
			],
			disputed: [],
			paid: [],
			cancelled: []
		};
		return transitions[currentStatus] || [];
	}

	get qrUrl() {
		if (!this.selectedBank || !this.debt) return '';
		const amount = this.debt.amount;
		const addInfo = `Debt ${this.debt.id}`;
		return `https://img.vietqr.io/image/${this.selectedBank.bankBin}-${this.selectedBank.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(this.selectedBank.accountName)}`;
	}

	handleUpload = async () => {
		if (!this.uploadFile || !this.uploadFile[0]) return;
		if (!this.debt) return;
		this.isUploading = true;
		this.uploadError = '';
		this.uploadSuccess = false;

		const res = await api.v1.proofs.debt({ debtId: this.debt.id }).post({ file: this.uploadFile[0] });

		this.isUploading = false;
		if (res.error) {
			this.uploadError = (res.error?.value as { message?: string })?.message || 'Upload failed';
		} else {
			this.uploadSuccess = true;
			this.uploadFile = undefined;
		}
	}
}
