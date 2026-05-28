<script lang="ts">
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import { Separator } from '$lib/components/ui/separator';
	import type { PageData } from './$types';
	
	// Sub-components
	import ActiveSessions from './components/ActiveSessions.svelte';
	import ChangePassword from './components/ChangePassword.svelte';
	import SecurityTips from './components/SecurityTips.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageContainer>
	<PageHeader 
		title="Security Settings" 
		description="Manage your account security and active sessions."
	/>

	<div class="space-y-8">
		<ActiveSessions 
			sessions={data.sessions} 
			currentSessionId={data.currentSessionId} 
		/>
		
		<Separator />
		
		<div class="grid gap-8 lg:grid-cols-2">
			<ChangePassword />
			<SecurityTips />
		</div>
	</div>
</PageContainer>
