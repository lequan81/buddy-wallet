<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>Buddy Wallet - Split Expenses Smart</title>
</svelte:head>

<!-- Hero Section -->
<section
	class="relative overflow-hidden bg-linear-to-br from-blue-50 via-white to-indigo-50 px-4 py-20 sm:px-6 sm:py-32 lg:px-8 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
>
	<div class="mx-auto max-w-5xl">
		<div class="text-center">
			<h1
				class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white"
			>
				Split Expenses,<br />
				<span class="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
					Build Harmony
				</span>
			</h1>
			<p class="mx-auto mt-6 max-w-2xl text-xl text-gray-600 dark:text-gray-300">
				Buddy Wallet makes it effortless to track shared expenses, settle debts, and maintain
				transparency with friends and roommates.
			</p>
			<div class="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
				<button
					on:click={() => goto('/login')}
					class="rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-blue-700"
				>
					Get Started
				</button>
				<button
					on:click={() => goto('/about')}
					class="rounded-lg border-2 border-gray-300 px-8 py-4 text-lg font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-slate-800"
				>
					Learn More
				</button>
			</div>
		</div>
	</div>

	<!-- Background decoration -->
	<div class="absolute inset-0 -z-10 overflow-hidden">
		<div
			class="absolute top-0 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100 opacity-50 blur-3xl dark:bg-blue-900/20"
		></div>
		<div
			class="absolute top-1/2 right-0 h-96 w-96 -translate-y-1/2 rounded-full bg-indigo-100 opacity-50 blur-3xl dark:bg-indigo-900/20"
		></div>
	</div>
</section>

<!-- Features Section -->
<section class="px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
	<div class="mx-auto max-w-5xl">
		<div class="mb-16 text-center">
			<h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
				Why Choose Buddy Wallet?
			</h2>
		</div>

		<div class="grid gap-8 md:grid-cols-3">
			<!-- Feature 1 -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-slate-800"
			>
				<div class="mb-4 text-3xl">👥</div>
				<h3 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">Easy Sharing</h3>
				<p class="text-gray-600 dark:text-gray-300">
					Add debts, track who owes what, and split expenses effortlessly among friends, roommates,
					and groups.
				</p>
			</div>

			<!-- Feature 2 -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-slate-800"
			>
				<div class="mb-4 text-3xl">📊</div>
				<h3 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">Full Transparency</h3>
				<p class="text-gray-600 dark:text-gray-300">
					See all balances, history, and who owes whom at a glance. No hidden charges or confusion.
				</p>
			</div>

			<!-- Feature 3 -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-slate-800"
			>
				<div class="mb-4 text-3xl">🔒</div>
				<h3 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">Secure & Private</h3>
				<p class="text-gray-600 dark:text-gray-300">
					Your financial data is encrypted and protected. We never share your information with third
					parties.
				</p>
			</div>

			<!-- Feature 4 -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-slate-800"
			>
				<div class="mb-4 text-3xl">⚡</div>
				<h3 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">Lightning Fast</h3>
				<p class="text-gray-600 dark:text-gray-300">
					Instant updates and real-time synchronization across all your devices. Always in sync.
				</p>
			</div>

			<!-- Feature 5 -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-slate-800"
			>
				<div class="mb-4 text-3xl">📱</div>
				<h3 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">Works Everywhere</h3>
				<p class="text-gray-600 dark:text-gray-300">
					Web, mobile, desktop. Access Buddy Wallet from any device, anytime, anywhere.
				</p>
			</div>

			<!-- Feature 6 -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-slate-800"
			>
				<div class="mb-4 text-3xl">🎯</div>
				<h3 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">Smart Management</h3>
				<p class="text-gray-600 dark:text-gray-300">
					Automatic balance calculations, settlement suggestions, and expense analytics at your
					fingertips.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- CTA Section -->
<section
	class="bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-20 sm:px-6 sm:py-32 lg:px-8 dark:from-blue-700 dark:to-indigo-700"
>
	<div class="mx-auto max-w-3xl text-center">
		<h2 class="mb-6 text-3xl font-bold text-white sm:text-4xl">Ready to Split Smart?</h2>
		<p class="mb-8 text-lg text-blue-100">
			Join thousands of friends, roommates, and groups who trust Buddy Wallet to manage shared
			expenses.
		</p>
		<button
			on:click={() => goto('/login')}
			class="rounded-lg bg-white px-8 py-4 text-lg font-semibold text-blue-600 shadow-lg transition-colors hover:bg-blue-50"
		>
			Start for Free
		</button>
	</div>
</section>

<!-- Links Section -->
<section class="border-t border-gray-200 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 dark:border-gray-700">
	<div class="mx-auto max-w-5xl">
		<div class="grid gap-6 text-center sm:grid-cols-3">
			<a
				href="/about"
				class="font-medium text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
			>
				About Us
			</a>
			<a
				href="/faq"
				class="font-medium text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
			>
				FAQ
			</a>
			<a
				href="/terms"
				class="font-medium text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
			>
				Terms & Conditions
			</a>
		</div>
	</div>
</section>
