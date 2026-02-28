<script lang="ts">
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { cn } from '$lib/utils';
	import IconLucideRefreshCw from '~icons/lucide/refresh-cw';
	import IconLucideAlertTriangle from '~icons/lucide/alert-triangle';
	import IconLucideWifiOff from '~icons/lucide/wifi-off';

	interface Props {
		onRetry: () => void;
		onUseOffline: () => void;
		isRetrying: boolean;
		errorMessage?: string;
		timeoutSeconds?: number;
	}

	let props = $props();
	let { 
		onRetry, 
		onUseOffline, 
		isRetrying, 
		errorMessage = 'Connection to server failed. Please check your internet connection.',
		timeoutSeconds = 30 
	} = props;

	let countdown = $state(timeoutSeconds);
	let showOfflineOption = $state(false);

	// Countdown timer
	$effect(() => {
		if (isRetrying && countdown > 0) {
			const interval = setInterval(() => {
				countdown = countdown - 1;
				if (countdown <= 0) {
					clearInterval(interval);
					showOfflineOption = true;
				}
			}, 1000);
			
			return () => clearInterval(interval);
		}
	});

	function handleRetry() {
		countdown = props.timeoutSeconds;
		showOfflineOption = false;
		onRetry();
	}

	function handleUseOffline() {
		onUseOffline();
	}

	function handleRetryClick() {
		handleRetry();
	}

	function handleUseOfflineClick() {
		handleUseOffline();
	}
</script>

<div class="container max-w-md mx-auto py-8">
	<Card.Root>
		<Card.Header class="text-center">
			<Card.Title class="flex items-center justify-center gap-2">
				<IconLucideWifiOff class="h-5 w-5 text-orange-500" />
				Connection Issues
			</Card.Title>
			<Card.Description>
				{#if isRetrying}
					<p class="mb-2">Attempting to reconnect to server...</p>
					<p class="text-sm text-muted-foreground">
						Timeout in {countdown}s
					</p>
				{:else}
					<p class="mb-2">{errorMessage}</p>
					<p class="text-sm text-muted-foreground">
						You can retry the connection or continue in offline mode.
					</p>
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				{#if isRetrying}
					<div class="flex items-center justify-center p-4">
						<IconLucideRefreshCw class="h-8 w-8 animate-spin text-primary" />
						<span class="ml-3">Retrying connection...</span>
					</div>
				{/if}

				<div class="flex flex-col gap-3">
					<Button 
						onclick={handleRetryClick}
						disabled={isRetrying && countdown > 0}
						class="w-full"
					>
						<IconLucideRefreshCw class="h-4 w-4 mr-2" />
						{isRetrying && countdown > 0 ? `Retry in ${countdown}s` : 'Retry Connection'}
					</Button>

					{#if showOfflineOption}
						<Button 
							variant="outline"
							onclick={handleUseOfflineClick}
							class="w-full"
						>
							<IconLucideWifiOff class="h-4 w-4 mr-2" />
							Continue Offline
						</Button>
					{/if}
				</div>

				{#if errorMessage}
					<div class="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
						<div class="flex items-start gap-2">
							<IconLucideAlertTriangle class="h-4 w-4 text-orange-600 mt-0.5" />
							<div class="text-sm text-orange-800">
								<strong>Troubleshooting:</strong>
								<ul class="mt-1 ml-4 list-disc">
									<li>Check your internet connection</li>
									<li>Verify server is running</li>
									<li>Try refreshing the page</li>
									<li>Contact support if issues persist</li>
								</ul>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
</div>

