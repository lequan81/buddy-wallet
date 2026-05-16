import { 
	phoneSchema, 
	amountClientSchema, 
	descriptionSchema, 
	validateField 
} from '@repo/schema/dto/debt';

export class CreateDebtState {
	// Form state
	phoneNumber = $state('');
	amount = $state('');
	description = $state('');
	direction = $state('LEND');
	expiryOption = $state('never');
	confirmDuplicate = $state(false);

	// UI state
	isSubmitting = $state(false);
	showAutocomplete = $state(false);
	showPreviewModal = $state(false);
	showDuplicateModal = $state(false);
	duplicateDebts = $state<Array<{ id: string; amount: number; description: string | null; createdAt: string }>>([]);

	// Data from props
	private hasBankAccount = $state(true);
	private recentContacts = $state<string[]>([]);

	// Expiry options
	readonly expiryOptions = [
		{
			value: 'never',
			label: 'No expiry (forever)',
			description: 'Debt stays until manually resolved'
		},
		{ value: '7d', label: '7 days', description: 'Auto-cancel if not confirmed in 1 week' },
		{ value: '30d', label: '30 days', description: 'Auto-cancel if not confirmed in 1 month' },
		{ value: '90d', label: '90 days', description: 'Auto-cancel if not confirmed in 3 months' }
	];

	constructor(data: { 
		prefill?: { phone: string; amount: string; description: string }; 
		hasBankAccount?: boolean; 
		recentContacts?: string[] 
	}) {
		this.phoneNumber = data.prefill?.phone || '';
		this.amount = data.prefill?.amount || '';
		this.description = data.prefill?.description || '';
		this.hasBankAccount = data.hasBankAccount ?? true;
		this.recentContacts = data.recentContacts || [];

		if (!this.hasBankAccount) {
			this.direction = 'BORROW';
		}
	}

	// Derived validation
	phoneResult = $derived(validateField(phoneSchema, this.phoneNumber));
	amountResult = $derived(validateField(amountClientSchema, this.amount));
	descriptionResult = $derived(validateField(descriptionSchema, this.description));

	// Derived logic
	canLend = $derived(this.hasBankAccount);
	
	autocompleteContacts = $derived.by(() => {
		if (!this.phoneNumber || this.phoneNumber.length < 2) return this.recentContacts.slice(0, 5);
		return this.recentContacts.filter((c: string) => c.includes(this.phoneNumber)).slice(0, 5);
	});

	get isValid() {
		return (
			this.phoneResult.state !== 'error' &&
			this.amountResult.state !== 'error' &&
			this.descriptionResult.state !== 'error' &&
			this.phoneNumber &&
			this.amount &&
			this.description
		);
	}

	resetDuplicates() {
		this.duplicateDebts = [];
		this.showDuplicateModal = false;
	}
}
