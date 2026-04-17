import { api } from '$lib/services/api';
import type { PageData } from './$types';
import type { BankAccount } from '@repo/types/core/bank';
import type { DebtDetails, DebtStatus } from '@repo/types/core/debt';
import { DEBT_STATUS } from '@repo/config/shared/status';

export class DebtDetailState {
	debt = $state<DebtDetails>();
	
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
		debt: DebtDetails,
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
		return this.isUploader && this.status === DEBT_STATUS.PENDING;
	}

	get canDelete() {
		return this.isUploader && this.status !== DEBT_STATUS.PAID;
	}

	get canSuggestEdit() {
		return !this.isUploader && (this.isCreditor || this.isDebtor) && this.status !== DEBT_STATUS.PAID && this.status !== DEBT_STATUS.CANCELLED;
	}

	get canConfirm() {
		return !this.isUploader && (this.isCreditor || this.isDebtor) && this.status === DEBT_STATUS.PENDING;
	}

	get hasPendingSuggestion() {
		return this.debt?.suggestedById && this.isUploader;
	}

	get validTransitions() {
		const currentStatus = this.status || '';
		const transitions: Record<string, { status: DebtStatus; label: string; icon: string; disabled?: boolean }[]> = {
			[DEBT_STATUS.PENDING]: [
				{ status: DEBT_STATUS.CONFIRMED, label: 'Confirm', icon: 'Check' },
				{ status: DEBT_STATUS.DISPUTED, label: 'Dispute', icon: 'AlertTriangle' },
				{ status: DEBT_STATUS.CANCELLED, label: 'Cancel', icon: 'X' }
			],
			[DEBT_STATUS.CONFIRMED]: [
				{
					status: DEBT_STATUS.PAID,
					label: 'Mark as Paid',
					icon: 'Check',
					disabled: !this.debt?.hasPendingProof
				},
				{ status: DEBT_STATUS.DISPUTED, label: 'Dispute', icon: 'AlertTriangle' }
			],
			[DEBT_STATUS.DISPUTED]: [],
			[DEBT_STATUS.PAID]: [],
			[DEBT_STATUS.CANCELLED]: []
		};
		return transitions[currentStatus] || [];
	}

	get qrUrl() {
		if (!this.selectedBank || !this.debt) return '';
		const addInfo = `Debt ${this.debt.id}`;
		return `https://img.vietqr.io/image/${this.selectedBank.bankBin}-${this.selectedBank.accountNumber}-compact2.png?amount=${this.debt.amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(this.selectedBank.accountName || '')}`;
	}

	handleUpload = async () => {
		if (!this.uploadFile || !this.uploadFile[0]) return;
		if (!this.debt) return;
		this.isUploading = true;
		this.uploadError = '';
		this.uploadSuccess = false;

		const res = await api.v1.upload['payment-proof']({ debtId: this.debt.id }).post({ file: this.uploadFile[0] });

		this.isUploading = false;
		if (res.error) {
			this.uploadError = (res.error?.value as { message?: string })?.message || 'Upload failed';
		} else {
			this.uploadSuccess = true;
			this.uploadFile = undefined;
		}
	}
}
