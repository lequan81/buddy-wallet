import { api } from '$lib/services/api';
import type { PageData } from './$types';
import type { BankAccount } from '@repo/types';

export function createDebtDetailState(
	debt: NonNullable<PageData['debt']>,
	creditorBanks: NonNullable<PageData['creditorBanks']>,
	currentUser: NonNullable<PageData['currentUser']>,
	isUploader: boolean,
	isCreditor: boolean,
	isDebtor: boolean
) {
	let debtState = $state(debt);

	// Modal state
	let showPayModal = $state(false);
	let showMarkAsPaidModal = $state(false);
	let showSuggestModal = $state(false);

	// General state
	let isSubmitting = $state(false);
	let isEditing = $state(false);
	let editDescription = $state(debtState?.description || '');
	let editAmount = $state(debtState?.amount?.toString() || '');

	// Bank state
	let selectedBankId = $state('');
	if (creditorBanks.length > 0 && !selectedBankId) {
		const def = creditorBanks.find((b: BankAccount) => b.isDefault);
		if (def) selectedBankId = def.id;
		else selectedBankId = creditorBanks[0].id;
	}

	const selectedBank = $derived(
		creditorBanks.find((b: BankAccount) => b.id === selectedBankId) ||
			creditorBanks.find((b: BankAccount) => b.isDefault) ||
			creditorBanks[0]
	);

	// Upload State
	let uploadFile = $state<FileList | undefined>(undefined);
	let isUploading = $state(false);
	let uploadError = $state('');
	let uploadSuccess = $state(false);

	let lastApprovedDebtId = $state('');

	// Suggest Edit state
	let suggestAmount = $state('');
	let suggestDescription = $state('');
	let isSuggesting = $state(false);

	// Extract permission logic (from useDebtPermissions pattern)
	const status = $derived(debtState?.status?.toLowerCase());
	const canEdit = $derived(isUploader && status === 'pending');
	const canDelete = $derived(isUploader && status !== 'paid');
	const canSuggestEdit = $derived(
		!isUploader && (isCreditor || isDebtor) && status !== 'paid' && status !== 'cancelled'
	);
	const canConfirm = $derived(!isUploader && (isCreditor || isDebtor) && status === 'pending');

	const hasPendingSuggestion = $derived(debtState?.suggestedById && isUploader);

	// Get valid status transitions based on current status
	const getTransitions = (currentStatus: string) => {
		const transitions: Record<
			string,
			{ status: string; label: string; icon: string; disabled?: boolean }[]
		> = {
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
					disabled: !debtState?.hasPendingProof
				},
				{ status: 'disputed', label: 'Dispute', icon: 'AlertTriangle' }
			],
			disputed: [],
			paid: [],
			cancelled: []
		};
		return transitions[currentStatus?.toLowerCase()] || [];
	};

	const validTransitions = $derived(getTransitions(debtState?.status || ''));

	// Generate QR URL
	const qrUrl = $derived.by(() => {
		if (!selectedBank || !debtState) return '';
		const amount = debtState.amount;
		const addInfo = `Debt ${debtState.id}`;
		return `https://img.vietqr.io/image/${selectedBank.bankBin}-${selectedBank.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(selectedBank.accountName)}`;
	});

	async function handleUpload() {
		if (!uploadFile || !uploadFile[0]) return;
		if (!debtState) return;
		isUploading = true;
		uploadError = '';
		uploadSuccess = false;

		const res = await api.v1.proofs.debt({ debtId: debtState.id }).post({ file: uploadFile[0] });

		isUploading = false;
		if (res.error) {
			uploadError = (res.error?.value as { message?: string })?.message || 'Upload failed';
		} else {
			uploadSuccess = true;
			uploadFile = undefined;
		}
	}

	return {
		get debt() {
			return debtState;
		},
		set debt(v) {
			debtState = v;
		},

		get showPayModal() {
			return showPayModal;
		},
		set showPayModal(v) {
			showPayModal = v;
		},
		get showMarkAsPaidModal() {
			return showMarkAsPaidModal;
		},
		set showMarkAsPaidModal(v) {
			showMarkAsPaidModal = v;
		},
		get showSuggestModal() {
			return showSuggestModal;
		},
		set showSuggestModal(v) {
			showSuggestModal = v;
		},

		get isSubmitting() {
			return isSubmitting;
		},
		set isSubmitting(v) {
			isSubmitting = v;
		},
		get isEditing() {
			return isEditing;
		},
		set isEditing(v) {
			isEditing = v;
		},
		get editDescription() {
			return editDescription;
		},
		set editDescription(v) {
			editDescription = v;
		},
		get editAmount() {
			return editAmount;
		},
		set editAmount(v) {
			editAmount = v;
		},

		get selectedBankId() {
			return selectedBankId;
		},
		set selectedBankId(v) {
			selectedBankId = v;
		},
		get selectedBank() {
			return selectedBank;
		},

		get uploadFile() {
			return uploadFile;
		},
		set uploadFile(v) {
			uploadFile = v;
		},
		get isUploading() {
			return isUploading;
		},
		set isUploading(v) {
			isUploading = v;
		},
		get uploadError() {
			return uploadError;
		},
		set uploadError(v) {
			uploadError = v;
		},
		get uploadSuccess() {
			return uploadSuccess;
		},
		set uploadSuccess(v) {
			uploadSuccess = v;
		},

		get lastApprovedDebtId() {
			return lastApprovedDebtId;
		},
		set lastApprovedDebtId(v) {
			lastApprovedDebtId = v;
		},

		get suggestAmount() {
			return suggestAmount;
		},
		set suggestAmount(v) {
			suggestAmount = v;
		},
		get suggestDescription() {
			return suggestDescription;
		},
		set suggestDescription(v) {
			suggestDescription = v;
		},
		get isSuggesting() {
			return isSuggesting;
		},
		set isSuggesting(v) {
			isSuggesting = v;
		},

		get canEdit() {
			return canEdit;
		},
		get canDelete() {
			return canDelete;
		},
		get canSuggestEdit() {
			return canSuggestEdit;
		},
		get canConfirm() {
			return canConfirm;
		},
		get hasPendingSuggestion() {
			return hasPendingSuggestion;
		},

		get validTransitions() {
			return validTransitions;
		},
		get qrUrl() {
			return qrUrl;
		},

		handleUpload
	};
}
