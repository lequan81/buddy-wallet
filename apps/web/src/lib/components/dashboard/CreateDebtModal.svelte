<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import * as Dialog from '@repo/ui/components/ui/dialog';
	import * as Drawer from '@repo/ui/components/ui/drawer';
	import { Button } from '@repo/ui/components/ui/button';
	import { Label } from '@repo/ui/components/ui/label';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { phoneSchema, amountClientSchema, descriptionSchema, validateField } from '@repo/schema/dto/debt';

	import {
		Phone,
		User as UserIcon,
		ArrowUp,
		ArrowDown,
		ArrowRight,
		ArrowLeft,
		Landmark,
		Loader2
	} from '@repo/icons';

	// --- Props ---
	let {
		open = $bindable(false),
		initialDescription = '',
		initialAmount = '',
		initialPhone = '',
		hasBankAccount = true,
		recentContacts = [],
		onSuccess
	} = $props<{
		open: boolean;
		initialDescription?: string;
		initialAmount?: string;
		initialPhone?: string;
		hasBankAccount?: boolean;
		recentContacts?: string[];
		onSuccess?: () => void;
	}>();

	// --- Consolidated form state ---
	let form = $state({
		phoneNumber: '',
		amount: '',
		description: '',
		direction: 'LEND' as 'LEND' | 'BORROW'
	});

	// --- UI state ---
	let ui = $state({
		step: 1,
		isDesktop: true,
		isSubmitting: false,
		showAutocomplete: false
	});

	// --- Valibot-driven validation (replaces hardcoded if-else chains) ---
	let phoneResult = $derived(validateField(phoneSchema, form.phoneNumber));
	let amountResult = $derived(validateField(amountClientSchema, form.amount));
	let descriptionResult = $derived(validateField(descriptionSchema, form.description));

	// --- Derived values ---
	let canLend = $derived(hasBankAccount);
	let direction = $derived(
		!hasBankAccount && form.direction === 'LEND' ? 'BORROW' : form.direction
	);

	let autocompleteContacts = $derived.by(() => {
		if (!form.phoneNumber || form.phoneNumber.length < 2) return recentContacts.slice(0, 5);
		return (recentContacts as string[]).filter((contact: string) => contact.includes(form.phoneNumber)).slice(0, 5);
	});

	let isStep1Valid = $derived(phoneResult.state === 'success');
	let isStep2Valid = $derived(
		amountResult.state === 'success' && descriptionResult.state === 'success'
	);

	// --- Step description (replaces repeated if/else in template) ---
	const stepDescriptions = {
		desktop: ['Who was this transaction with and what was the direction?', 'Enter the financial details for this ledger entry.'],
		mobile: ['Who was this with?', 'Financial details']
	} as const;

	// --- Lifecycle ---
	onMount(() => {
		ui.isDesktop = window.innerWidth >= 768;
		const handleResize = () => (ui.isDesktop = window.innerWidth >= 768);
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// --- Reset/prefill on open/close ---
	$effect(() => {
		if (!open) {
			setTimeout(() => {
				form = { phoneNumber: initialPhone, amount: initialAmount, description: initialDescription, direction: 'LEND' };
				ui.step = 1;
			}, 300);
		} else if (initialAmount || initialDescription) {
			ui.step = 2; // Jump to step 2 if prefilled from quick actions
		}
	});

	// --- Form submission handler ---
	function handleFormSubmit() {
		ui.isSubmitting = true;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: (opts: { reset: boolean }) => Promise<void> }) => {
			ui.isSubmitting = false;

			switch (result.type) {
				case 'success':
				case 'redirect':
					toast.success('Debt recorded successfully!');
					open = false;
					invalidateAll();
					onSuccess?.();
					break;
				case 'failure':
					toast.error((result.data?.message as string) || 'Failed to create record');
					break;
			}
			await update({ reset: false });
		};
	}
</script>

{#snippet formContent()}
	<form
		method="POST"
		action="/debts/create"
		use:enhance={handleFormSubmit}
		class="space-y-6 flex flex-col pt-4"
	>
		{#if ui.step === 1}
			<div class="space-y-6 animate-in fade-in slide-in-from-right-4">
				{#if !hasBankAccount}
					<div class="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex gap-3">
						<Landmark class="h-5 w-5 text-destructive shrink-0 mt-0.5" />
						<div class="text-sm">
							<p class="font-semibold text-destructive">Bank Account Required to Lend</p>
							<p class="text-muted-foreground mt-1">Add a bank in settings to let others pay you via QR. You can only record borrowing right now.</p>
						</div>
					</div>
				{/if}

				<div class="space-y-3 relative z-50">
					<Label for="drawerPhone" class="text-sm font-medium">Counterparty Phone</Label>
					<FormInput
						id="drawerPhone"
						name="counterpartyPhone"
						type="tel"
						placeholder="0901234567"
						bind:value={form.phoneNumber}
						validationState={phoneResult.state}
						error={phoneResult.state === 'error' ? phoneResult.message : undefined}
						warning={phoneResult.state === 'warning' ? phoneResult.message : undefined}
						onfocus={() => (ui.showAutocomplete = true)}
						onblur={() => setTimeout(() => (ui.showAutocomplete = false), 200)}
						icon={Phone}
						required
					/>

					{#if ui.showAutocomplete && autocompleteContacts.length > 0}
						<div class="absolute w-full mt-1 z-50 rounded-md border border-border/50 bg-popover shadow-md overflow-hidden">
							<div class="py-1">
								<p class="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground opacity-70">Recent Contacts</p>
								{#each autocompleteContacts as contact}
									<button
										type="button"
										class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted"
										onmousedown={() => {
											form.phoneNumber = contact;
											ui.showAutocomplete = false;
										}}
									>
										<div class="bg-primary/10 p-1.5 rounded-md">
											<UserIcon class="h-3.5 w-3.5 text-primary" />
										</div>
										<span class="font-medium">{contact}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<div class="space-y-3">
					<Label class="text-sm font-medium">Transaction Direction</Label>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<input
								type="radio"
								name="direction"
								value="LEND"
								id="drawerLend"
								class="peer sr-only"
								checked={direction === 'LEND'}
								onchange={() => (form.direction = 'LEND')}
								disabled={!canLend}
							/>
							<Label
								for="drawerLend"
								class={cn(
									'flex cursor-pointer flex-col p-4 border border-border/50 rounded-xl transition-all',
									!canLend && 'opacity-50 cursor-not-allowed bg-muted/20',
									direction === 'LEND' && canLend
										? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/50'
										: 'hover:bg-muted/30'
								)}
							>
								<div class="flex items-center gap-2 mb-1.5">
									<ArrowUp class={cn('h-4 w-4', direction === 'LEND' ? 'text-emerald-500' : 'text-muted-foreground')} />
									<span class={cn('font-semibold', direction === 'LEND' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>I Lent</span>
								</div>
								<span class="text-xs text-muted-foreground">They owe me money</span>
							</Label>
						</div>

						<div>
							<input
								type="radio"
								name="direction"
								value="BORROW"
								id="drawerBorrow"
								class="peer sr-only"
								checked={direction === 'BORROW'}
								onchange={() => (form.direction = 'BORROW')}
							/>
							<Label
								for="drawerBorrow"
								class={cn(
									'flex cursor-pointer flex-col p-4 border border-border/50 rounded-xl transition-all',
									direction === 'BORROW'
										? 'border-destructive/50 bg-destructive/5 ring-1 ring-destructive/50'
										: 'hover:bg-muted/30'
								)}
							>
								<div class="flex items-center gap-2 mb-1.5">
									<ArrowDown class={cn('h-4 w-4', direction === 'BORROW' ? 'text-destructive' : 'text-muted-foreground')} />
									<span class={cn('font-semibold', direction === 'BORROW' ? 'text-destructive' : 'text-foreground')}>I Borrowed</span>
								</div>
								<span class="text-xs text-muted-foreground">I owe them money</span>
							</Label>
						</div>
					</div>
				</div>

				<div class="pt-2 flex justify-end">
					<Button
						type="button"
						onclick={() => ui.step = 2}
						disabled={!isStep1Valid}
						class="w-full sm:w-auto mt-2"
					>
						Next Details <ArrowRight class="ml-2 h-4 w-4" />
					</Button>
				</div>
			</div>
		{:else if ui.step === 2}
			<div class="space-y-6 animate-in fade-in slide-in-from-right-4">
				<div class="space-y-4">
					<FormInput
						label="Amount (VND)"
						name="amount"
						type="number"
						placeholder="150000"
						bind:value={form.amount}
						validationState={amountResult.state}
						error={amountResult.state === 'error' ? amountResult.message : undefined}
						min="1000"
						step="1000"
						required
					/>

					<FormInput
						label="Description / Note"
						name="description"
						type="text"
						placeholder="Dinner, Tickets, etc..."
						bind:value={form.description}
						validationState={descriptionResult.state}
						error={descriptionResult.state === 'error' ? descriptionResult.message : undefined}
						required
					/>
				</div>

				<div class="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2 mt-4">
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Counterparty:</span>
						<span class="font-medium">{form.phoneNumber || 'Not set'}</span>
					</div>
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Type:</span>
						<Badge variant={direction === 'LEND' ? 'default' : 'destructive'} class="text-xs">
							{direction === 'LEND' ? 'They Owe You' : 'You Owe Them'}
						</Badge>
					</div>
				</div>

				<!-- Hidden fields required by backend API -->
				<input type="hidden" name="direction" value={direction} />
				<input type="hidden" name="counterpartyPhone" value={form.phoneNumber} />
				<input type="hidden" name="expiryOption" value="never" />
				<input type="hidden" name="confirmDuplicate" value="false" />

				<div class="pt-4 flex items-center justify-between gap-3">
					<Button type="button" variant="ghost" onclick={() => ui.step = 1}>
						<ArrowLeft class="mr-2 h-4 w-4" /> Back
					</Button>
					<Button
						type="submit"
						disabled={ui.isSubmitting || !isStep2Valid}
						class="flex-1"
					>
						{#if ui.isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Recording...
						{:else}
							Confirm & Record
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	</form>
{/snippet}

{#if ui.isDesktop}
	<Dialog.Root bind:open>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title class="text-xl">Record Transaction</Dialog.Title>
				<Dialog.Description>{stepDescriptions.desktop[ui.step - 1]}</Dialog.Description>
			</Dialog.Header>
			<div class="px-1 text-left">
				{@render formContent()}
			</div>
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Drawer.Root bind:open>
		<Drawer.Content class="px-5 pb-8 pt-2">
			<Drawer.Header class="text-left px-0 pb-2">
				<Drawer.Title class="text-xl">Record Transaction</Drawer.Title>
				<Drawer.Description>{stepDescriptions.mobile[ui.step - 1]}</Drawer.Description>
			</Drawer.Header>
			{@render formContent()}
		</Drawer.Content>
	</Drawer.Root>
{/if}
