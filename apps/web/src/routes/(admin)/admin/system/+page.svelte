<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import {
		Activity,
		Server,
		Database,
		Cpu,
		Clock,
		Users,
		AlertCircle,
		CheckCircle2
	} from '@lucide/svelte';
	import * as Card from '@repo/ui/components/ui/card';
	import { Progress } from '@repo/ui/components/ui/progress';

	let { data } = $props();

	let interval: Timer;

	onMount(() => {
		// Auto refresh every 30s
		interval = setInterval(() => {
			invalidateAll();
		}, 30000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	function formatUptime(seconds: number) {
		const d = Math.floor(seconds / (3600 * 24));
		const h = Math.floor((seconds % (3600 * 24)) / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		return `${d}d ${h}h ${m}m ${s}s`;
	}

	function formatBytes(bytes: number) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold tracking-tight">System Status</h2>
		<p class="text-muted-foreground">Real-time monitoring of API and infrastructure.</p>
	</div>

	{#if data.health}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<!-- API Status -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">API Status</Card.Title>
					{#if data.health.status === 'ok'}
						<CheckCircle2 class="h-4 w-4 text-green-500" />
					{:else}
						<AlertCircle class="h-4 w-4 text-red-500" />
					{/if}
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold uppercase">{data.health.status}</div>
					<p class="text-xs text-muted-foreground">Version: {data.health.version}</p>
				</Card.Content>
			</Card.Root>

			<!-- Uptime -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Uptime</Card.Title>
					<Clock class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{formatUptime(data.health.uptime || 0)}</div>
					<p class="text-xs text-muted-foreground">Since last restart</p>
				</Card.Content>
			</Card.Root>

			<!-- Active Sessions -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Active Sessions</Card.Title>
					<Users class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{data.health.activeSessions?.count || '-'}</div>
					<p class="text-xs text-muted-foreground">Currently online users</p>
				</Card.Content>
			</Card.Root>

			<!-- Memory -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Memory Usage</Card.Title>
					<Cpu class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">
						{formatBytes(data.health.memory?.heapUsed || 0)}
					</div>
					<Progress
						value={(data.health.memory?.heapUsed / data.health.memory?.rss) * 100}
						class="mt-2"
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						RSS: {formatBytes(data.health.memory?.rss || 0)}
					</p>
				</Card.Content>
			</Card.Root>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
			<Card.Root class="col-span-4">
				<Card.Header>
					<Card.Title>OpenTelemetry Status</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium">Tracing Enabled</span>
							<span
								class={`rounded-full px-2 py-1 text-xs ${
									data.health.otel?.enabled
										? 'bg-green-100 text-green-800'
										: 'bg-yellow-100 text-yellow-800'
								}`}
							>
								{data.health.otel?.enabled ? 'Active' : 'Disabled'}
							</span>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	{:else}
		<div class="flex h-100 items-center justify-center rounded-lg border border-dashed">
			<div class="flex flex-col items-center gap-2 text-muted-foreground">
				<AlertCircle class="h-8 w-8" />
				<p>System metrics unavailable</p>
			</div>
		</div>
	{/if}
</div>
