<script lang="ts">
	import { LogOut, Monitor, Smartphone, Tablet } from '@repo/icons';
	import { formatDate } from '@repo/utils/format';
	import { Button } from '@repo/ui/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { toast } from 'svelte-sonner';
	import { logoutAll } from '$lib/remotes/security.remote';

	let { sessions, currentSessionId } = $props<{ sessions: Array<{ id: string; deviceType?: string | null; deviceName?: string | null; ipAddress?: string | null; lastActiveAt?: string | Date | null }>, currentSessionId: string }>();

	let showLogoutAllDialog = $state(false);
	let isLoggingOutAll = $state(false);
	let isRevoking = $state<string | null>(null);

	function getDeviceIcon(deviceType: string) {
		switch (deviceType?.toLowerCase()) {
			case 'mobile':
				return Smartphone;
			case 'tablet':
				return Tablet;
			default:
				return Monitor;
		}
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h4 class="text-sm font-medium">Active Sessions</h4>
		<Button
			variant="outline"
			size="sm"
			class="text-destructive hover:bg-destructive/10"
			onclick={() => (showLogoutAllDialog = true)}
		>
			Logout all other devices
		</Button>
	</div>

	<div class="divide-y rounded-md border">
		{#each sessions as session}
			{@const isCurrent = session.id === currentSessionId}
			{@const Icon = getDeviceIcon(session.deviceType)}
			<div class="flex items-center justify-between p-4">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
						<Icon class="h-5 w-5 text-muted-foreground" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<p class="text-sm font-medium">{session.deviceName || 'Unknown Device'}</p>
							{#if isCurrent}
								<span
									class="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"
								>
									Current
								</span>
							{/if}
						</div>
						<div class="flex items-center gap-2 text-xs text-muted-foreground">
							<span>{session.ipAddress || 'Unknown IP'}</span>
							<span>•</span>
							<span>Last active {formatDate(session.lastActiveAt)}</span>
						</div>
					</div>
				</div>
				{#if !isCurrent}
					<Button
						variant="ghost"
						size="sm"
						disabled={isRevoking === session.id}
						onclick={() => toast.error('Individual session revocation not yet implemented')}
					>
						<LogOut class="h-4 w-4" />
					</Button>
				{/if}
			</div>
		{/each}
	</div>
</div>

<AlertDialog.Root bind:open={showLogoutAllDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Logout from all devices?</AlertDialog.Title>
			<AlertDialog.Description>
				This will end all your sessions except for the current one. You will need to log in again on
				your other devices.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<form
			{...logoutAll.enhance(async ({ submit }) => {
				isLoggingOutAll = true;
				try {
					await submit();
				} catch {
					toast.error('Failed to logout all devices');
				} finally {
					isLoggingOutAll = false;
				}
			})}
		>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
				<Button type="submit" variant="destructive" disabled={isLoggingOutAll}>
					{#if isLoggingOutAll}
						Logging out...
					{:else}
						Yes, logout all
					{/if}
				</Button>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
