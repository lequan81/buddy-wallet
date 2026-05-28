<script lang="ts">
	import Activity from '~icons/lucide/activity';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { formatDuration, TRACE_STATUS_COLORS, cn } from '$lib/utils';

	interface Trace {
		name: string;
		traceId: string;
		duration: number;
		status: unknown;
		timestamp: string | number;
	}

	let { data } = $props<{ data: { traces: Trace[] } }>();

	const getTraceStatusCode = (status: unknown): keyof typeof TRACE_STATUS_COLORS => {
	if (typeof status === 'object' && status !== null && 'code' in status) {
		const code = (status as { code?: string }).code;
		if (typeof code === 'string' && code in TRACE_STATUS_COLORS) {
			return code as keyof typeof TRACE_STATUS_COLORS;
		}
	}
	return 'UNSET';
};
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
									<Badge
										variant="outline"
										class={cn(
											'border-0 text-white',
											TRACE_STATUS_COLORS[getTraceStatusCode(trace.status)] || TRACE_STATUS_COLORS.UNSET
										)}
									>
										{getTraceStatusCode(trace.status)}
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
