import { phoneSchema, amountClientSchema, descriptionSchema, validateField } from '@repo/schema/dto/debt';

export class CreateDebtModalState {
	// Form state
	phoneNumber = $state('');
	amount = $state('');
	description = $state('');
	direction = $state<'LEND' | 'BORROW'>('LEND');

	// UI state
	step = $state(1);
	isSubmitting = $state(false);
	showAutocomplete = $state(false);
	isDesktop = $state(true);

	// Config
	hasBankAccount: boolean = false;
	recentContacts: string[] = [];

	constructor(config: {
		hasBankAccount: boolean;
		recentContacts: string[];
		initialPhone?: string;
		initialAmount?: string;
		initialDescription?: string;
	}) {
		this.hasBankAccount = config.hasBankAccount;
		this.recentContacts = config.recentContacts;
		this.phoneNumber = config.initialPhone || '';
		this.amount = config.initialAmount || '';
		this.description = config.initialDescription || '';
	}

	// Derived validation
	phoneResult = $derived(validateField(phoneSchema, this.phoneNumber));
	amountResult = $derived(validateField(amountClientSchema, this.amount));
	descriptionResult = $derived(validateField(descriptionSchema, this.description));

	canLend = $derived(this.hasBankAccount);
	actualDirection = $derived(
		!this.hasBankAccount && this.direction === 'LEND' ? 'BORROW' : this.direction
	);

	autocompleteContacts = $derived.by(() => {
		if (!this.phoneNumber || this.phoneNumber.length < 2) return this.recentContacts.slice(0, 5);
		return this.recentContacts.filter((contact) => contact.includes(this.phoneNumber)).slice(0, 5);
	});

	isStep1Valid = $derived(this.phoneResult.state === 'success');
	isStep2Valid = $derived(
		this.amountResult.state === 'success' && this.descriptionResult.state === 'success'
	);

	reset(initialPhone = '', initialAmount = '', initialDescription = '') {
		this.phoneNumber = initialPhone;
		this.amount = initialAmount;
		this.description = initialDescription;
		this.direction = 'LEND';
		this.step = 1;
	}

	nextStep() {
		if (this.isStep1Valid) {
			this.step = 2;
		}
	}

	prevStep() {
		this.step = 1;
	}
}
