<script lang="ts">
	import * as Card from '@repo/ui/components/ui/card';
	import * as Table from '@repo/ui/components/ui/table';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { Activity } from '@lucide/svelte';

	let { data } = $props();

	function formatDuration(ms: number) {
		if (ms < 1) return '< 1ms';
		return `${ms.toFixed(2)}ms`;
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'OK':
				return 'bg-green-500';
			case 'ERROR':
				return 'bg-red-500';
			default:
				return 'bg-gray-500';
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold tracking-tight">System Traces</h2>
		<p class="text-muted-foreground">Recent API request traces and performance spans.</p>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Recent Spans</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if data.traces && data.traces.length > 0}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Name</Table.Head>
							<Table.Head>Trace ID</Table.Head>
							<Table.Head>Duration</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Time</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.traces as trace}
							<Table.Row>
								<Table.Cell class="font-medium">{trace.name}</Table.Cell>
								<Table.Cell class="font-mono text-xs">{trace.traceId.substring(0, 8)}...</Table.Cell
								>
								<Table.Cell>{formatDuration(trace.duration)}</Table.Cell>
								<Table.Cell>
									<Badge variant="outline" class={getStatusColor(trace.status?.code)}>
										{trace.status?.code || 'UNSET'}
									</Badge>
								</Table.Cell>
								<Table.Cell>{new Date(trace.timestamp).toLocaleTimeString()}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<div
					class="flex flex-col items-center justify-center p-8 text-center text-muted-foreground"
				>
					<Activity class="mb-2 h-8 w-8 opacity-50" />
					<p>No traces available or OTLP exporter not configured.</p>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
