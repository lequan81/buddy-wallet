<script lang="ts">
	import {
		CheckCircle,
		PartyPopper,
		ArrowRight,
		Home,
		TrendingUp,
		TrendingDown
	} from '@lucide/svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import confetti from 'canvas-confetti';
	import { onMount } from 'svelte';

	let { data } = $props();

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
	};

	// Trigger confetti animation on mount for paid status
	onMount(() => {
		if (data.status === 'paid' && data.debt) {
			// Fire confetti
			confetti({
				particleCount: 100,
				spread: 70,
				origin: { y: 0.6 }
			});
		}
	});

	const getStatusMessage = () => {
		if (data.status === 'paid') {
			return {
				title: 'Debt Marked as Paid!',
				subtitle: 'This debt has been successfully settled.',
				icon: PartyPopper,
				color: 'text-green-600'
			};
		}
		return {
			title: 'Debt Confirmed!',
			subtitle: 'Both parties have acknowledged this debt.',
			icon: CheckCircle,
			color: 'text-blue-600'
		};
	};

	const statusInfo = $derived(getStatusMessage());
	const StatusIcon = $derived(statusInfo.icon);
</script>

<svelte:head>
	<title>{data.status === 'paid' ? 'Debt Paid' : 'Debt Confirmed'}</title>
</svelte:head>

<div
	class="container mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-8"
>
	{#if !data.debt}
		<!-- Error state -->
		<div class="text-center">
			<h1 class="mb-2 text-xl font-semibold">Debt not found</h1>
			<p class="mb-6 text-muted-foreground">{data.error || 'Unable to load debt information'}</p>
			<Button href="/dashboard">
				<Home class="mr-2 h-4 w-4" />
				Go to Dashboard
			</Button>
		</div>
	{:else}
		<!-- Success state -->
		<div class="w-full rounded-xl border bg-card p-8 text-center shadow-lg">
			<!-- Icon -->
			<div
				class="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full {data.status ===
				'paid'
					? 'bg-green-100 dark:bg-green-900/30'
					: 'bg-blue-100 dark:bg-blue-900/30'}"
			>
				<StatusIcon class="h-12 w-12 {statusInfo.color}" />
			</div>

			<!-- Title -->
			<h1 class="mb-2 text-2xl font-bold {statusInfo.color}">{statusInfo.title}</h1>
			<p class="mb-8 text-muted-foreground">{statusInfo.subtitle}</p>

			<!-- Debt Summary Card -->
			<div class="mb-8 rounded-lg bg-muted/50 p-6">
				<div class="mb-4 flex items-center justify-center gap-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-full {data.isCreditor
							? 'bg-green-100 dark:bg-green-900/30'
							: 'bg-red-100 dark:bg-red-900/30'}"
					>
						{#if data.isCreditor}
							<TrendingUp class="h-6 w-6 text-green-600" />
						{:else}
							<TrendingDown class="h-6 w-6 text-red-600" />
						{/if}
					</div>
					<div class="text-left">
						<p class="text-sm text-muted-foreground">
							{data.isCreditor ? 'You were owed' : 'You owed'}
						</p>
						<p class="text-2xl font-bold {data.isCreditor ? 'text-green-600' : 'text-red-600'}">
							{formatCurrency(data.debt.amount)}
						</p>
					</div>
				</div>

				{#if data.debt.description}
					<p class="text-sm text-muted-foreground">
						<span class="font-medium">Description:</span>
						{data.debt.description}
					</p>
				{/if}

				<div class="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
					<span>
						{data.isCreditor ? 'From:' : 'To:'}
					</span>
					<span class="font-medium">
						{data.isCreditor ? data.debt.debtorPhone : data.debt.creditorPhone}
					</span>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
				<Button href="/debts/{data.debt.id}" variant="outline">
					View Debt Details
					<ArrowRight class="ml-2 h-4 w-4" />
				</Button>
				<Button href="/dashboard">
					<Home class="mr-2 h-4 w-4" />
					Back to Dashboard
				</Button>
			</div>
		</div>

		<!-- Status badge at bottom -->
		<p class="mt-6 text-center text-sm text-muted-foreground">
			Status: <span
				class="rounded-full px-2 py-0.5 text-xs font-medium {data.status === 'paid'
					? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
					: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}"
			>
				{data.status?.toUpperCase()}
			</span>
		</p>
	{/if}
</div>
