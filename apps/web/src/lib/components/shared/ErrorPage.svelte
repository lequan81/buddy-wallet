<script lang="ts">
	import { resolve } from '$app/paths';
	import AlertCircle from '~icons/lucide/alert-circle';
import ArrowLeft from '~icons/lucide/arrow-left';
import HelpCircle from '~icons/lucide/help-circle';
import Home from '~icons/lucide/home';
import Loader2 from '~icons/lucide/loader2';
import RotateCcw from '~icons/lucide/rotate-ccw';
import Wallet from '~icons/lucide/wallet';
	import { invalidateAll, afterNavigate } from '$app/navigation';
	import { getErrorInfo, getErrorMessage } from '$lib/errors';
	import { cn } from '$lib/utils';

	type Variant = 'full' | 'card' | 'inline' | 'minimal';

	let {
		status,
		message,
		variant = 'card',
		showLogo = true,
		showFaq = false,
		showSupport = false,
		homeLink = '/',
		homeLabel = 'Go Home'
	} = $props<{
		status: number;
		message?: string;
		variant?: Variant;
		showLogo?: boolean;
		showFaq?: boolean;
		showSupport?: boolean;
		homeLink?: string;
		homeLabel?: string;
	}>();

	const info = $derived(getErrorInfo(status));
	const errorMessage = $derived(getErrorMessage(status, message));
	const isServerError = $derived(status >= 500);

	let isRetrying = $state(false);

	async function handleRetry() {
		isRetrying = true;
		try {
			await invalidateAll();
		} finally {
			isRetrying = false;
		}
	}

	// Important: Clear the error state when navigating away or going back
	afterNavigate(async () => {
		await invalidateAll();
	});
</script>

<svelte:head>
	<title>{status} - {info.title} | Buddy Wallet</title>
</svelte:head>

{#snippet actions(layout: 'row' | 'column' = 'row')}
	<div
		class={cn(
			'flex w-full gap-3',
			layout === 'column' ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row sm:justify-center'
		)}
	>
		<!-- Retry Button (only for 5xx errors) -->
		{#if isServerError}
			<button
				onclick={handleRetry}
				disabled={isRetrying}
				class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
			>
				{#if isRetrying}
					<Loader2 class="h-4 w-4 animate-spin" />
					Retrying...
				{:else}
					<RotateCcw class="h-4 w-4" />
					Try Again
				{/if}
			</button>
		{/if}

		<a
			href={homeLink}
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white transition-colors hover:bg-primary/90"
		>
			<Home class="h-4 w-4" />
			{homeLabel}
		</a>

		<button
			onclick={async () => {
				await invalidateAll();
				window.history.back();
			}}
			class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
		>
			<ArrowLeft class="h-4 w-4" />
			Go Back
		</button>
	</div>
{/snippet}

{#if variant === 'full'}
	<!-- Full page error with background -->
	<div
		class="flex min-h-dvh flex-col items-center justify-center bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-20 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
	>
		{#if showLogo}
			<a href={resolve(`/`, {})} class="mb-12 flex items-center space-x-2">
				<Wallet class="h-8 w-8 text-primary" />
				<span class="text-2xl font-bold">Buddy Wallet</span>
			</a>
		{/if}

		<div
			class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-slate-800"
		>
			<!-- Status Code Header -->
			<div
				class="flex items-center justify-center gap-4 border-b border-gray-200 px-8 py-8 dark:border-gray-700"
			>
				<div class="text-6xl">{info.emoji}</div>
				<div class="text-right">
					<div class="text-5xl font-bold text-gray-900 dark:text-white">{status}</div>
					<div class="text-sm text-gray-600 dark:text-gray-400">Error Code</div>
				</div>
			</div>

			<!-- Content -->
			<div class="px-8 py-8">
				<h1 class="mb-3 text-2xl font-bold text-gray-900 dark:text-white">{info.title}</h1>
				<p class="mb-6 text-gray-600 dark:text-gray-300">{info.description}</p>

				{#if message}
					<div
						class="mb-6 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-900/20"
					>
						<div class="flex gap-3">
							<AlertCircle class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
							<div class="text-sm text-amber-800 dark:text-amber-200">
								<p class="font-medium">Details:</p>
								<p class="mt-1 text-xs">{errorMessage}</p>
							</div>
						</div>
					</div>
				{:else}
					<p
						class="mb-6 rounded-lg bg-gray-100 p-4 text-sm text-gray-700 dark:bg-gray-700/50 dark:text-gray-300"
					>
						{errorMessage}
					</p>
				{/if}

				{@render actions('column')}

				{#if showFaq}
					<a
						href={resolve(`/faq`, {})}
						class="mt-4 flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
					>
						<HelpCircle class="h-4 w-4" />
						View FAQ
					</a>
				{/if}
			</div>
		</div>

		{#if showSupport}
			<p class="mt-12 text-center text-sm text-gray-600 dark:text-gray-400">
				Need help?
				<a href="mailto:support@buddywallet.com" class="font-medium text-primary hover:underline">
					Contact Support
				</a>
			</p>
		{/if}
	</div>
{:else if variant === 'card'}
	<!-- Card variant - fits within existing layout -->
	<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20">
		<div class="w-full max-w-md text-center">
			<div class="mb-8 text-6xl">{info.emoji}</div>
			<h1 class="mb-2 text-4xl font-bold text-gray-900 dark:text-white">{status}</h1>
			<h2 class="mb-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">{info.title}</h2>
			<p class="mb-8 text-gray-600 dark:text-gray-400">{info.description}</p>

			{#if message}
				<div
					class="mb-8 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-left dark:bg-amber-900/20"
				>
					<p class="text-sm text-amber-800 dark:text-amber-200">{message}</p>
				</div>
			{/if}

			{@render actions('row')}
		</div>
	</div>
{:else if variant === 'inline'}
	<!-- Inline alert variant - for admin/dashboard -->
	<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20">
		<div
			class="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-900/50 dark:bg-red-900/10"
		>
			<div class="flex gap-4">
				<AlertCircle class="h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
				<div>
					<h1 class="mb-2 text-lg font-bold text-red-900 dark:text-red-200">
						{info.title}
						<span class="ml-2 text-sm font-normal">({status})</span>
					</h1>
					<p class="mb-2 text-sm text-red-800 dark:text-red-300">{info.description}</p>
					{#if message}
						<p class="mb-4 text-xs text-red-700 dark:text-red-400">{message}</p>
					{/if}

					<div class="flex gap-2">
						{#if isServerError}
							<button
								onclick={handleRetry}
								class="inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
							>
								{#if isRetrying}
									<Loader2 class="h-4 w-4 animate-spin" />
									Retrying...
								{:else}
									<RotateCcw class="h-4 w-4" />
									Retry
								{/if}
							</button>
						{/if}
						<a
							href={homeLink}
							class="inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
						>
							<Home class="h-4 w-4" />
							{homeLabel}
						</a>
						<button
							onclick={async () => {
								await invalidateAll();
								window.history.back();
							}}
							class="inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
						>
							<ArrowLeft class="h-4 w-4" />
							Back
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{:else if variant === 'minimal'}
	<!-- Minimal variant - simple centered text -->
	<div
		class="flex min-h-dvh flex-col items-center justify-center bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-20 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
	>
		{#if showLogo}
			<a href={resolve(`/`, {})} class="mb-8 flex items-center space-x-2">
				<Wallet class="h-8 w-8 text-primary" />
				<span class="text-2xl font-bold">Buddy Wallet</span>
			</a>
		{/if}

		<div
			class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-slate-800"
		>
			<div class="px-8 py-12 text-center">
				<div class="mb-6 text-5xl">{info.emoji}</div>
				<h1 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Error {status}</h1>
				<p class="mb-6 text-gray-600 dark:text-gray-400">
					{message || info.description}
				</p>

				{@render actions('row')}
			</div>
		</div>
	</div>
{/if}
